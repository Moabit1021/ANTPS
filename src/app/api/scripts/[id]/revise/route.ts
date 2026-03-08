import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { reviseScript } from "@/lib/llm"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { instructions } = body as { instructions: string }

  if (!instructions?.trim()) {
    return NextResponse.json(
      { error: "Bitte geben Sie Anweisungen fuer die Ueberarbeitung ein." },
      { status: 400 }
    )
  }

  // Fetch the current script
  const currentScript = await prisma.podcastScript.findUnique({
    where: { id },
    include: {
      sources: true,
    },
  })

  if (!currentScript) {
    return NextResponse.json({ error: "Skript nicht gefunden" }, { status: 404 })
  }

  // Set current script to REVISING
  await prisma.podcastScript.update({
    where: { id },
    data: { status: "REVISING" },
  })

  try {
    const result = await reviseScript(currentScript.content, instructions.trim())

    // Create a new script version linked to the parent
    const newScript = await prisma.podcastScript.create({
      data: {
        title: currentScript.title,
        content: result.content,
        version: currentScript.version + 1,
        parentId: currentScript.id,
        status: "DRAFT",
        modelUsed: result.model,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        config: { revisionInstructions: instructions.trim() },
        sources: {
          create: currentScript.sources.map((s) => ({ sourceId: s.sourceId })),
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

    // Mark old version as REVISING (keeps it accessible but indicates it's been revised)
    await prisma.podcastScript.update({
      where: { id },
      data: { status: "REVISING" },
    })

    return NextResponse.json(newScript, { status: 201 })
  } catch (error) {
    // Reset status on failure
    await prisma.podcastScript.update({
      where: { id },
      data: { status: currentScript.status },
    })

    console.error("Script revision error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ueberarbeitung fehlgeschlagen" },
      { status: 500 }
    )
  }
}
