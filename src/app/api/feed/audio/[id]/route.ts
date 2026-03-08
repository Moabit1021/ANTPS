import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readFile, stat } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

// GET - Public audio streaming for podcast feed enclosures
// No authentication required - this is accessed by podcast players
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const audio = await prisma.podcastAudio.findUnique({
    where: { id },
    include: { episode: true },
  })

  if (!audio) {
    return NextResponse.json({ error: "Audio nicht gefunden" }, { status: 404 })
  }

  // Only serve audio that belongs to a published episode
  if (!audio.episode || audio.episode.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Episode nicht veröffentlicht" }, { status: 403 })
  }

  try {
    const absolutePath = path.join(process.cwd(), audio.filePath)
    const fileStat = await stat(absolutePath)
    const range = request.headers.get("range")

    // Support Range requests for podcast players
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1
      const chunkSize = end - start + 1

      const buffer = await readFile(absolutePath)
      const chunk = buffer.subarray(start, end + 1)

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400",
        },
      })
    }

    const buffer = await readFile(absolutePath)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${audio.fileName}"`,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Audiodatei nicht gefunden" }, { status: 404 })
  }
}
