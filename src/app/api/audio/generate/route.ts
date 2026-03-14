import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"
import { multiVoiceTextToSpeech } from "@/lib/elevenlabs"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
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

  // Check ownership for non-admins
  if (user.role !== "ADMIN" && script.userId && script.userId !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
  }

  if (!script.content.trim()) {
    return NextResponse.json({ error: "Skript hat keinen Inhalt." }, { status: 400 })
  }

  // Get ElevenLabs config for storing voice/model info
  const elConfig = await prisma.appSetting.findMany({
    where: {
      key: {
        in: ["elevenlabs_voice_id", "elevenlabs_voice_id_2", "elevenlabs_model"],
      },
    },
  })
  const configMap: Record<string, string> = {}
  for (const s of elConfig) configMap[s.key] = s.value

  try {
    // Generate audio via ElevenLabs (auto-detects single vs multi-voice)
    const result = await multiVoiceTextToSpeech(script.content)

    // Save audio file to disk
    const audioDir = path.join(process.cwd(), "data", "audio")
    await mkdir(audioDir, { recursive: true })

    const fileName = `podcast-${script.id}-${Date.now()}.mp3`
    const filePath = path.join(audioDir, fileName)
    await writeFile(filePath, result.audioBuffer)

    // Estimate duration (rough: ~150 words per minute)
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
        voiceKimId: configMap.elevenlabs_voice_id_2 || "",
        modelId: configMap.elevenlabs_model || "eleven_multilingual_v2",
        status: "COMPLETED",
        userId: user.id,
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
