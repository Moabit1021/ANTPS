import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, requireAdmin } from "@/lib/auth"
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
  "elevenlabs_voice_id", // ElevenLabs voice ID (Voice 1 / default)
  "elevenlabs_voice_id_2", // ElevenLabs voice ID 2 (Voice 2)
  "elevenlabs_voice_name_1", // Display name for voice 1 (used as speaker marker)
  "elevenlabs_voice_name_2", // Display name for voice 2 (used as speaker marker)
  "elevenlabs_model",    // ElevenLabs model ID
  "smtp_host",           // SMTP server hostname
  "smtp_port",           // SMTP server port
  "smtp_user",           // SMTP username
  "smtp_pass",           // SMTP password
  "smtp_from_email",     // From email address
  "smtp_from_name",      // From display name
  "smtp_secure",         // Use SSL/TLS ("true" | "false")
] as const

// Defaults
const DEFAULTS: Record<string, string> = {
  llm_provider: "anthropic",
  llm_model: "claude-sonnet-4-20250514",
  prompt_system: `Du bist ein erfahrener Podcast-Redakteur. Deine Aufgabe ist es, aus den bereitgestellten Quellen ein unterhaltsames und informatives Podcast-Skript zu erstellen.

Rahmenbedingungen:
- Heutiges Datum / Datum der Folge: {{date}}
- Ziellaenge: ca. {{duration}} Minuten Sprechzeit
{{speaker_mode}}

Inhaltliche Vorgaben:
- In einem natuerlichen, gesprochenen Deutsch verfasst
- Die wichtigsten Themen aus den Quellen zusammenfassen und einordnen
- Nenne die Quelle (Name des Newsletters, Dokuments oder Absenders) wenn du ein Thema einfuehrst
- Fachbegriffe kurz erklaeren, ohne belehrend zu wirken
- Uebergaenge zwischen Themen natuerlich gestalten

Format des Skripts:
- Beginne mit einer kurzen Begruessung und nenne das Datum der Folge, gefolgt von einer Vorschau der Themen
- Die Sprecher stellen sich NICHT namentlich vor
- Gliedere in Abschnitte mit klaren Uebergaengen
- Schliesse mit einer Zusammenfassung und Verabschiedung

KRITISCH - Text-to-Speech Regeln (das Skript wird direkt an ElevenLabs TTS gesendet):
- Verwende KEINERLEI Markdown (kein **, kein *, kein #, kein ---, keine Aufzaehlungszeichen)
- Schreibe KEINE Regieanweisungen, Abschnittstitel oder Ueberschriften (kein "HAUPTTEIL", "EINLEITUNG" etc.)
- Schreibe NUR Text, der tatsaechlich laut vorgelesen werden soll
- Die EINZIGE erlaubte Sonderformatierung sind die Sprecher-Markierungen in eckigen Klammern
- Schreibe alle Zahlen ALS WORTE aus (z.B. "dreiundzwanzig" statt "23", "zweitausendsechsundzwanzig" statt "2026")
- Schreibe Abkuerzungen aus (z.B. "zum Beispiel" statt "z.B.", "und so weiter" statt "usw.")
- Schreibe Symbole als Worte (z.B. "Prozent" statt "%", "Euro" statt "€", "Paragraph" statt "§")
- Verwende Interpunktion bewusst fuer das Sprechtempo: Punkt fuer Pausen, Komma fuer kurze Pausen, Gedankenstrich fuer Unterbrechungen, Ellipsis fuer Zoegern
- Schreibe ganze, zusammenhaengende Absaetze - keine einzelnen kurzen Saetze

Antwortformat:
Beginne deine Antwort IMMER mit genau drei Zeilen fuer Metadaten, gefolgt von einer Leerzeile und dann dem Skript:
TITEL: [Vorschlag fuer den Episodentitel, kurz und praegnant]
BESCHREIBUNG: [2-3 Saetze Zusammenfassung fuer die Episodenbeschreibung]
---
[Hier folgt das eigentliche Podcast-Skript]`,

  prompt_user_template: `Erstelle ein Podcast-Skript basierend auf den folgenden Quellen:

{{sources}}

Erstelle daraus ein zusammenhaengendes, unterhaltsames Podcast-Skript. Denke daran, mit TITEL: und BESCHREIBUNG: zu beginnen.`,
  elevenlabs_model: "eleven_multilingual_v2",
  elevenlabs_voice_name_1: "Alex",
  elevenlabs_voice_name_2: "Kim",
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  })

  const result: Record<string, string> = { ...DEFAULTS }
  for (const s of settings) {
    result[s.key] = s.value
  }

  // Mask API keys and passwords for security
  const secretKeys = ["llm_api_key", "elevenlabs_api_key", "smtp_pass"] as const
  for (const keyName of secretKeys) {
    if (result[keyName]) {
      const val = result[keyName]
      result[`${keyName}_masked`] = val.length > 8
        ? val.slice(0, 4) + "..." + val.slice(-4)
        : "****"
      result[keyName] = ""
      result[`${keyName}_set`] = "true"
    } else {
      result[`${keyName}_set`] = "false"
      result[`${keyName}_masked`] = ""
    }
  }

  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const body = await request.json()

  const updates: { key: string; value: string }[] = []

  for (const key of SETTING_KEYS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      // Don't overwrite secrets with empty string (means "keep existing")
      if ((key === "llm_api_key" || key === "elevenlabs_api_key" || key === "smtp_pass") && body[key] === "") {
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
