import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { textToSpeech } from "@/lib/elevenlabs"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()
  const { scriptId } = body as { scriptId: string }

  if (!scriptId) {
    return NextResponse.json({ error: "scriptId ist erforderlich." }, { status: 400 })
  }

  const script = await prisma.podcastScript.findUnique({
    where: { id: scriptId },
  })

  if (!script) {
    return NextResponse.json({ error: "Skript nicht gefunden." }, { status: 404 })
  }

  if (!script.content.trim()) {
    return NextResponse.json({ error: "Skript hat keinen Inhalt." }, { status: 400 })
  }

  // Get ElevenLabs config for storing voice/model info
  const elConfig = await prisma.appSetting.findMany({
    where: { key: { in: ["elevenlabs_voice_id", "elevenlabs_model"] } },
  })
  const configMap: Record<string, string> = {}
  for (const s of elConfig) configMap[s.key] = s.value

  try {
    // Generate audio via ElevenLabs
    const result = await textToSpeech(script.content)

    // Save audio file to disk
    const audioDir = path.join(process.cwd(), "data", "audio")
    await mkdir(audioDir, { recursive: true })

    const fileName = `podcast-${script.id}-${Date.now()}.mp3`
    const filePath = path.join(audioDir, fileName)
    await writeFile(filePath, result.audioBuffer)

    // Estimate duration (rough: ~150 words per minute, average word length 5 chars)
    const wordCount = script.content.split(/\s+/).length
    const estimatedDuration = Math.round((wordCount / 150) * 60)

    // Create PodcastAudio record
    const audio = await prisma.podcastAudio.create({
      data: {
        scriptId: script.id,
        filePath: `data/audio/${fileName}`,
        fileName,
        fileSize: result.audioBuffer.length,
        duration: estimatedDuration,
        voiceAlexId: configMap.elevenlabs_voice_id || "",
        voiceKimId: "",
        modelId: configMap.elevenlabs_model || "eleven_multilingual_v2",
        status: "COMPLETED",
      },
      include: {
        script: { select: { id: true, title: true } },
      },
    })

    // Update script status
    await prisma.podcastScript.update({
      where: { id: scriptId },
      data: { status: "COMPLETED" },
    })

    return NextResponse.json(audio, { status: 201 })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audio-Generierung fehlgeschlagen" },
      { status: 500 }
    )
  }
}
