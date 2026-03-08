import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Settings keys we support
const SETTING_KEYS = [
  "llm_provider",        // "anthropic" | "openai"
  "llm_api_key",         // API key (stored encrypted-ish, masked on read)
  "llm_model",           // model ID e.g. "claude-sonnet-4-20250514"
  "prompt_system",       // System prompt for script generation
  "prompt_user_template", // User prompt template (with {{sources}} placeholder)
  "elevenlabs_api_key",  // ElevenLabs API key for TTS
] as const

// Defaults
const DEFAULTS: Record<string, string> = {
  llm_provider: "anthropic",
  llm_model: "claude-sonnet-4-20250514",
  prompt_system: `Du bist ein erfahrener Podcast-Redakteur. Deine Aufgabe ist es, aus Newsletter-Inhalten ein unterhaltsames und informatives Podcast-Skript zu erstellen.

Das Skript soll:
- In einem natuerlichen, gesprochenen Deutsch verfasst sein
- Die wichtigsten Themen aus den Quellen zusammenfassen und einordnen
- Einen klaren roten Faden haben (Begruessung, Themen, Abschluss)
- Fuer eine Laenge von ca. 5-10 Minuten Sprechzeit ausgelegt sein
- Fachbegriffe kurz erklaeren, ohne belehrend zu wirken
- Uebergaenge zwischen Themen natuerlich gestalten

Format des Skripts:
- Beginne mit einer kurzen Begruessung und Vorschau der Themen
- Gliedere in Abschnitte mit klaren Uebergaengen
- Schliesse mit einer Zusammenfassung und Verabschiedung
- Verwende KEINE Markdown-Formatierung im Skript selbst
- Schreibe den Text so, wie er vorgelesen werden soll`,

  prompt_user_template: `Erstelle ein Podcast-Skript basierend auf den folgenden Newsletter-Quellen:

{{sources}}

Erstelle daraus ein zusammenhaengendes, unterhaltsames Podcast-Skript.`,
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  })

  const result: Record<string, string> = { ...DEFAULTS }
  for (const s of settings) {
    result[s.key] = s.value
  }

  // Mask API keys for security
  if (result.llm_api_key) {
    const key = result.llm_api_key
    result.llm_api_key_masked = key.length > 8
      ? key.slice(0, 4) + "..." + key.slice(-4)
      : "****"
    result.llm_api_key = "" // Don't send the actual key
    result.llm_api_key_set = "true"
  } else {
    result.llm_api_key_set = "false"
    result.llm_api_key_masked = ""
  }

  if (result.elevenlabs_api_key) {
    const key = result.elevenlabs_api_key
    result.elevenlabs_api_key_masked = key.length > 8
      ? key.slice(0, 4) + "..." + key.slice(-4)
      : "****"
    result.elevenlabs_api_key = ""
    result.elevenlabs_api_key_set = "true"
  } else {
    result.elevenlabs_api_key_set = "false"
    result.elevenlabs_api_key_masked = ""
  }

  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()

  const updates: { key: string; value: string }[] = []

  for (const key of SETTING_KEYS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      // Don't overwrite API key with empty string (means "keep existing")
      if ((key === "llm_api_key" || key === "elevenlabs_api_key") && body[key] === "") {
        continue
      }
      updates.push({ key, value: String(body[key]) })
    }
  }

  // Upsert all settings
  for (const { key, value } of updates) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }

  return NextResponse.json({ success: true })
}
