import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  // Check if this is a download/stream request
  const { searchParams } = request.nextUrl
  const stream = searchParams.get("stream") === "true"

  const audio = await prisma.podcastAudio.findUnique({
    where: { id },
    include: {
      script: { select: { id: true, title: true } },
    },
  })

  if (!audio) {
    return NextResponse.json({ error: "Audio nicht gefunden" }, { status: 404 })
  }

  if (stream) {
    // Stream the audio file
    try {
      const absolutePath = path.join(process.cwd(), audio.filePath)
      const buffer = await readFile(absolutePath)

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(buffer.length),
          "Content-Disposition": `inline; filename="${audio.fileName}"`,
        },
      })
    } catch {
      return NextResponse.json({ error: "Audiodatei nicht gefunden" }, { status: 404 })
    }
  }

  return NextResponse.json(audio)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  await prisma.podcastAudio.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
