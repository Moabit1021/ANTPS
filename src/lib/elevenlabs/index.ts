import { prisma } from "@/lib/prisma"

interface ElevenLabsConfig {
  apiKey: string
  voiceId1: string
  voiceId2: string
  voiceName1: string
  voiceName2: string
  model: string
}

export async function getElevenLabsConfig(): Promise<ElevenLabsConfig> {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "elevenlabs_api_key",
          "elevenlabs_voice_id",
          "elevenlabs_voice_id_2",
          "elevenlabs_voice_name_1",
          "elevenlabs_voice_name_2",
          "elevenlabs_model",
        ],
      },
    },
  })

  const map: Record<string, string> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  return {
    apiKey: map.elevenlabs_api_key || "",
    voiceId1: map.elevenlabs_voice_id || "",
    voiceId2: map.elevenlabs_voice_id_2 || "",
    voiceName1: map.elevenlabs_voice_name_1 || "Alex",
    voiceName2: map.elevenlabs_voice_name_2 || "Kim",
    model: map.elevenlabs_model || "eleven_multilingual_v2",
  }
}

export interface TTSResult {
  audioBuffer: Buffer
  contentType: string
}

// ---- Script cleaning for TTS ----

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Cleans a script before sending to TTS.
 * Removes markdown formatting, section headers, stage directions,
 * and normalizes speaker markers to the [Name] format.
 */
export function cleanScriptForTTS(
  content: string,
  speakerNames: string[]
): string {
  let cleaned = content

  // Normalize "Name:" or "**Name**:" format to [Name] for known speakers
  // Must happen BEFORE stripping markdown so we can match **Name**:
  for (const name of speakerNames) {
    // Match variations: "Name:", "**Name**:", "**Name:**", "  Name : "
    const namePattern = new RegExp(
      `^\\s*(?:\\*\\*)?\\s*${escapeRegex(name)}\\s*(?:\\*\\*)?\\s*:\\s*`,
      "gim"
    )
    cleaned = cleaned.replace(namePattern, `[${name}] `)
  }

  // Remove markdown bold/italic: **text** -> text, *text* -> text
  // But preserve [Name] markers (which don't contain **)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1")
  cleaned = cleaned.replace(/(?<!\[)\*([^*]+)\*(?!\])/g, "$1")

  // Remove markdown headers: # text, ## text, etc.
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "")

  // Remove horizontal rules: ---, ***, ___
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, "")

  // Remove markdown bullet points at start of lines
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, "")

  // Remove lines that are ONLY section headers / stage directions
  // (all-caps words like HAUPTTEIL, EINLEITUNG, ABSCHLUSS, ENDE, INTRO, OUTRO)
  cleaned = cleaned.replace(/^\s*[A-ZÄÖÜ][A-ZÄÖÜ\s\-:.,!?]{2,}\s*$/gm, "")

  // Remove lines that look like stage directions in parentheses: (Pause), (Musik), etc.
  cleaned = cleaned.replace(/^\s*\([^)]+\)\s*$/gm, "")

  // Normalize common symbols to spoken words (safety net if LLM didn't)
  cleaned = cleaned.replace(/(\d)\s*%/g, "$1 Prozent")
  cleaned = cleaned.replace(/(\d)\s*€/g, "$1 Euro")
  cleaned = cleaned.replace(/€\s*(\d)/g, "$1 Euro")
  cleaned = cleaned.replace(/(\d)\s*\$/g, "$1 Dollar")
  cleaned = cleaned.replace(/§\s*/g, "Paragraph ")
  cleaned = cleaned.replace(/&/g, " und ")
  cleaned = cleaned.replace(/\+/g, " plus ")

  // Clean up abbreviations the LLM might have left
  cleaned = cleaned.replace(/\bz\.B\./g, "zum Beispiel")
  cleaned = cleaned.replace(/\bd\.h\./g, "das heisst")
  cleaned = cleaned.replace(/\bu\.a\./g, "unter anderem")
  cleaned = cleaned.replace(/\busw\./g, "und so weiter")
  cleaned = cleaned.replace(/\bbzw\./g, "beziehungsweise")
  cleaned = cleaned.replace(/\bca\./g, "circa")
  cleaned = cleaned.replace(/\bMio\./g, "Millionen")
  cleaned = cleaned.replace(/\bMrd\./g, "Milliarden")

  // Remove empty lines that resulted from stripping (collapse multiple blank lines)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n")

  return cleaned.trim()
}

// ---- Script parsing for multi-voice ----

export interface ScriptSegment {
  speaker: string // speaker name or "" for narration
  text: string
}

/**
 * Parses a script into segments by speaker markers.
 * Supports formats like:
 *   [Alex] Text here...
 *   [Kim] More text...
 *   Alex: Text here...
 *   Kim: More text...
 *
 * Text without a speaker marker is assigned to the default speaker.
 */
export function parseScriptSegments(
  content: string,
  speakerNames: string[]
): ScriptSegment[] {
  const segments: ScriptSegment[] = []
  // Build regex that matches speaker markers at start of line
  // Supports [Name] or Name: formats
  const namesPattern = speakerNames.map((n) => escapeRegex(n)).join("|")
  const markerRegex = new RegExp(
    `^\\s*(?:\\[(${namesPattern})\\]|\\b(${namesPattern})\\s*:)\\s*`,
    "im"
  )

  let remaining = content.trim()
  let currentSpeaker = ""

  while (remaining.length > 0) {
    const match = markerRegex.exec(remaining)

    if (!match) {
      // No more markers - rest goes to current speaker
      const text = remaining.trim()
      if (text) {
        if (segments.length > 0 && segments[segments.length - 1].speaker === currentSpeaker) {
          segments[segments.length - 1].text += "\n" + text
        } else {
          segments.push({ speaker: currentSpeaker, text })
        }
      }
      break
    }

    // Text before the marker belongs to current speaker
    const beforeMarker = remaining.slice(0, match.index).trim()
    if (beforeMarker) {
      if (segments.length > 0 && segments[segments.length - 1].speaker === currentSpeaker) {
        segments[segments.length - 1].text += "\n" + beforeMarker
      } else {
        segments.push({ speaker: currentSpeaker, text: beforeMarker })
      }
    }

    // Switch speaker
    currentSpeaker = (match[1] || match[2]).trim()
    remaining = remaining.slice(match.index + match[0].length)

    // Find text until next marker or end
    const nextMatch = markerRegex.exec(remaining)
    let segmentText: string
    if (nextMatch) {
      segmentText = remaining.slice(0, nextMatch.index).trim()
      remaining = remaining.slice(nextMatch.index)
    } else {
      segmentText = remaining.trim()
      remaining = ""
    }

    if (segmentText) {
      segments.push({ speaker: currentSpeaker, text: segmentText })
    }
  }

  return segments
}

// ---- TTS generation ----

async function generateSegmentAudio(
  apiKey: string,
  voiceId: string,
  model: string,
  text: string
): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
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
  return Buffer.from(arrayBuffer)
}

/**
 * Generate audio for a single-voice script.
 * Cleans the script before sending to TTS.
 */
export async function textToSpeech(text: string): Promise<TTSResult> {
  const config = await getElevenLabsConfig()

  if (!config.apiKey) {
    throw new Error("Kein ElevenLabs API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  if (!config.voiceId1) {
    throw new Error("Keine ElevenLabs Voice-ID konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  // Clean script: remove formatting artifacts, keep only spoken text
  const speakerNames = [config.voiceName1]
  if (config.voiceName2) speakerNames.push(config.voiceName2)
  const cleanedText = cleanScriptForTTS(text, speakerNames)

  // For single voice, also strip any remaining [Name] markers
  const strippedText = cleanedText.replace(
    new RegExp(`\\[(?:${speakerNames.map(escapeRegex).join("|")})\\]\\s*`, "gi"),
    ""
  )

  const audioBuffer = await generateSegmentAudio(
    config.apiKey,
    config.voiceId1,
    config.model,
    strippedText
  )

  return { audioBuffer, contentType: "audio/mpeg" }
}

/**
 * Generate audio for a multi-voice script.
 * Cleans the script, parses speaker markers, and generates each segment
 * with the appropriate voice. MP3 segments are concatenated.
 */
export async function multiVoiceTextToSpeech(content: string): Promise<TTSResult> {
  const config = await getElevenLabsConfig()

  if (!config.apiKey) {
    throw new Error("Kein ElevenLabs API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  if (!config.voiceId1) {
    throw new Error("Keine Stimme 1 konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  // Build voice map: speaker name -> voice ID
  const voiceMap: Record<string, string> = {}
  voiceMap[config.voiceName1.toLowerCase()] = config.voiceId1
  if (config.voiceId2 && config.voiceName2) {
    voiceMap[config.voiceName2.toLowerCase()] = config.voiceId2
  }

  const speakerNames = [config.voiceName1]
  if (config.voiceName2) speakerNames.push(config.voiceName2)

  // Clean the script before parsing
  const cleanedContent = cleanScriptForTTS(content, speakerNames)

  const segments = parseScriptSegments(cleanedContent, speakerNames)

  if (segments.length === 0) {
    throw new Error("Skript enthielt keinen Text zum Vertonen.")
  }

  // Check if script actually uses multiple voices
  const hasMultipleVoices = segments.some(
    (s) => s.speaker.toLowerCase() !== segments[0].speaker.toLowerCase() && s.speaker !== ""
  )

  // If only one voice or no markers found, use simple single-voice
  if (!hasMultipleVoices) {
    return textToSpeech(content)
  }

  // Generate audio for each segment sequentially
  const audioBuffers: Buffer[] = []
  for (const segment of segments) {
    const voiceId =
      voiceMap[segment.speaker.toLowerCase()] || config.voiceId1

    const buffer = await generateSegmentAudio(
      config.apiKey,
      voiceId,
      config.model,
      segment.text
    )
    audioBuffers.push(buffer)
  }

  // Concatenate MP3 buffers
  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0)
  const combined = Buffer.concat(audioBuffers, totalLength)

  return { audioBuffer: combined, contentType: "audio/mpeg" }
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
