import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateScript } from "@/lib/llm"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()
  const { sourceIds, title } = body as { sourceIds: string[]; title?: string }

  if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return NextResponse.json(
      { error: "Mindestens eine Quelle muss ausgewaehlt werden." },
      { status: 400 }
    )
  }

  // Fetch sources
  const sources = await prisma.source.findMany({
    where: { id: { in: sourceIds } },
  })

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Quellen gefunden." },
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
      sources: {
        create: sourceIds.map((sourceId) => ({ sourceId })),
      },
    },
  })

  // Generate script via LLM
  try {
    const result = await generateScript(
      sources.map((s) => ({ title: s.title, plainText: s.plainText }))
    )

    // Update script with generated content
    const updated = await prisma.podcastScript.update({
      where: { id: script.id },
      data: {
        content: result.content,
        status: "DRAFT",
        modelUsed: result.model,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
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

    return NextResponse.json(updated, { status: 201 })
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
