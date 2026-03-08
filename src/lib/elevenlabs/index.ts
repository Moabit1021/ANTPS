import { prisma } from "@/lib/prisma"

interface ElevenLabsConfig {
  apiKey: string
  voiceId: string
  model: string
}

export async function getElevenLabsConfig(): Promise<ElevenLabsConfig> {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: { in: ["elevenlabs_api_key", "elevenlabs_voice_id", "elevenlabs_model"] },
    },
  })

  const map: Record<string, string> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  return {
    apiKey: map.elevenlabs_api_key || "",
    voiceId: map.elevenlabs_voice_id || "",
    model: map.elevenlabs_model || "eleven_multilingual_v2",
  }
}

export interface TTSResult {
  audioBuffer: Buffer
  contentType: string
}

export async function textToSpeech(text: string): Promise<TTSResult> {
  const config = await getElevenLabsConfig()

  if (!config.apiKey) {
    throw new Error("Kein ElevenLabs API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  if (!config.voiceId) {
    throw new Error("Keine ElevenLabs Voice-ID konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: config.model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err.detail?.message || err.detail || err.message || res.statusText
    throw new Error(`ElevenLabs API Fehler (${res.status}): ${detail}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const audioBuffer = Buffer.from(arrayBuffer)
  const contentType = res.headers.get("content-type") || "audio/mpeg"

  return { audioBuffer, contentType }
}

export interface VoiceInfo {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
}

export async function listVoices(apiKey: string): Promise<VoiceInfo[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  })

  if (!res.ok) {
    throw new Error(`ElevenLabs API Fehler: ${res.statusText}`)
  }

  const data = await res.json()
  return data.voices || []
}
