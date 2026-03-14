import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"
import { generateScript } from "@/lib/llm"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const body = await request.json()
  const {
    sourceIds,
    title,
    speakers,
    duration,
    systemPrompt,
    userTemplate,
  } = body as {
    sourceIds: string[]
    title?: string
    speakers?: number
    duration?: number
    systemPrompt?: string
    userTemplate?: string
  }

  if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return NextResponse.json(
      { error: "Mindestens eine Quelle muss ausgewaehlt werden." },
      { status: 400 }
    )
  }

  // Fetch sources (scoped to user for non-admins)
  const sources = await prisma.source.findMany({
    where: {
      id: { in: sourceIds },
      ...(user.role !== "ADMIN" ? { userId: user.id } : {}),
    },
  })

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "Keine gueltigen Quellen gefunden." },
      { status: 404 }
    )
  }

  // Create script record in GENERATING status
  const scriptTitle =
    title ||
    `Podcast vom ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`

  const script = await prisma.podcastScript.create({
    data: {
      title: scriptTitle,
      content: "",
      status: "GENERATING",
      userId: user.id,
      config: {
        speakers: speakers || 2,
        duration: duration || 10,
      },
      sources: {
        create: sourceIds.map((sourceId) => ({ sourceId })),
      },
    },
  })

  // Generate script via LLM
  try {
    const result = await generateScript({
      sources: sources.map((s) => ({ title: s.title, plainText: s.plainText })),
      speakers,
      duration,
      systemPrompt: systemPrompt || undefined,
      userTemplate: userTemplate || undefined,
    })

    // Use suggested title if no custom title provided
    const finalTitle = title
      ? title
      : result.suggestedTitle || scriptTitle

    // Update script with generated content
    const updated = await prisma.podcastScript.update({
      where: { id: script.id },
      data: {
        title: finalTitle,
        content: result.content,
        status: "DRAFT",
        modelUsed: result.model,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        config: {
          speakers: speakers || 2,
          duration: duration || 10,
          suggestedTitle: result.suggestedTitle || undefined,
          suggestedDescription: result.suggestedDescription || undefined,
        },
      },
      include: {
        sources: {
          include: {
            source: { select: { id: true, title: true, type: true } },
          },
        },
      },
    })

    // Mark sources as USED
    await prisma.source.updateMany({
      where: { id: { in: sourceIds } },
      data: { status: "USED" },
    })

    return NextResponse.json({
      ...updated,
      suggestedTitle: result.suggestedTitle,
      suggestedDescription: result.suggestedDescription,
    }, { status: 201 })
  } catch (error) {
    // Update script to show error
    await prisma.podcastScript.update({
      where: { id: script.id },
      data: {
        content: `Fehler bei der Generierung: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        status: "DRAFT",
      },
    })

    console.error("Script generation error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Skript-Generierung fehlgeschlagen",
        scriptId: script.id,
      },
      { status: 500 }
    )
  }
}
