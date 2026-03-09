import { prisma } from "@/lib/prisma"

// Default prompts with placeholders:
// {{speaker_mode}} - "monolog" or "dialog" instruction block
// {{duration}} - target duration in minutes
// {{date}} - episode date
// {{voice_name_1}}, {{voice_name_2}} - speaker names
const DEFAULT_SYSTEM_PROMPT = `Du bist ein erfahrener Podcast-Redakteur. Deine Aufgabe ist es, aus den bereitgestellten Quellen ein unterhaltsames und informatives Podcast-Skript zu erstellen.

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
[Hier folgt das eigentliche Podcast-Skript]`

const SPEAKER_MODE_MONOLOG = `- Format: MONOLOG mit einem einzigen Sprecher
- Markiere JEDEN Absatz mit [{{voice_name_1}}] am Anfang
- Verwende AUSSCHLIESSLICH den Namen {{voice_name_1}} - keine anderen Namen oder Bezeichnungen`

const SPEAKER_MODE_DIALOG = `- Format: DIALOG zwischen genau zwei Sprechern
- Die Sprecher heissen: {{voice_name_1}} und {{voice_name_2}} - verwende EXAKT diese Namen, keine anderen
- {{voice_name_1}} moderiert und fuehrt durch die Themen
- {{voice_name_2}} ergaenzt mit Einordnungen, Fragen und Kommentaren
- Markiere JEDEN Sprecherwechsel mit [{{voice_name_1}}] oder [{{voice_name_2}}] am Anfang des Absatzes
- Verwende NUR diese exakten Markierungen: [{{voice_name_1}}] und [{{voice_name_2}}]
- Verwende NIEMALS andere Formate wie "Name:", "**Name**", "Mann:", "Frau:" etc.
- Gestalte den Dialog natuerlich, nicht wie ein Interview`

const DEFAULT_USER_TEMPLATE = `Erstelle ein Podcast-Skript basierend auf den folgenden Quellen:

{{sources}}

Erstelle daraus ein zusammenhaengendes, unterhaltsames Podcast-Skript. Denke daran, mit TITEL: und BESCHREIBUNG: zu beginnen.`

interface LLMConfig {
  provider: string
  apiKey: string
  model: string
  systemPrompt: string
  userTemplate: string
  voiceName1: string
  voiceName2: string
}

export async function getLLMConfig(): Promise<LLMConfig> {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "llm_provider",
          "llm_api_key",
          "llm_model",
          "prompt_system",
          "prompt_user_template",
          "elevenlabs_voice_name_1",
          "elevenlabs_voice_name_2",
        ],
      },
    },
  })

  const map: Record<string, string> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  return {
    provider: map.llm_provider || "anthropic",
    apiKey: map.llm_api_key || "",
    model: map.llm_model || "claude-sonnet-4-20250514",
    systemPrompt: map.prompt_system || DEFAULT_SYSTEM_PROMPT,
    userTemplate: map.prompt_user_template || DEFAULT_USER_TEMPLATE,
    voiceName1: map.elevenlabs_voice_name_1 || "Alex",
    voiceName2: map.elevenlabs_voice_name_2 || "Kim",
  }
}

// Get the default prompts (for API consumers that need them)
export function getDefaultPrompts() {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userTemplate: DEFAULT_USER_TEMPLATE,
    speakerModeMonolog: SPEAKER_MODE_MONOLOG,
    speakerModeDialog: SPEAKER_MODE_DIALOG,
  }
}

interface SourceInput {
  title: string
  plainText: string
}

function formatSources(sources: SourceInput[]): string {
  return sources
    .map((s, i) => `--- Quelle ${i + 1}: ${s.title} ---\n${s.plainText}`)
    .join("\n\n")
}

// Resolve all placeholders in a prompt
function resolvePrompt(
  template: string,
  vars: {
    speakers: number
    duration: number
    date: string
    voiceName1: string
    voiceName2: string
    sources?: string
  }
): string {
  const speakerMode = vars.speakers === 1
    ? SPEAKER_MODE_MONOLOG
        .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
    : SPEAKER_MODE_DIALOG
        .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
        .replace(/\{\{voice_name_2\}\}/g, vars.voiceName2)

  let result = template
    .replace(/\{\{speaker_mode\}\}/g, speakerMode)
    .replace(/\{\{duration\}\}/g, String(vars.duration))
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
    .replace(/\{\{voice_name_2\}\}/g, vars.voiceName2)

  if (vars.sources !== undefined) {
    result = result.replace(/\{\{sources\}\}/g, vars.sources)
  }

  return result
}

interface GenerationResult {
  content: string
  suggestedTitle: string
  suggestedDescription: string
  model: string
  promptTokens: number
  outputTokens: number
}

// Parse the LLM response to extract metadata and script
function parseResponse(raw: string): { title: string; description: string; script: string } {
  const lines = raw.split("\n")
  let title = ""
  let description = ""
  let scriptStartIndex = 0

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim()
    if (line.startsWith("TITEL:")) {
      title = line.replace("TITEL:", "").trim()
    } else if (line.startsWith("BESCHREIBUNG:")) {
      description = line.replace("BESCHREIBUNG:", "").trim()
    } else if (line === "---") {
      scriptStartIndex = i + 1
      break
    }
  }

  // If we found metadata, take everything after the separator
  const script = scriptStartIndex > 0
    ? lines.slice(scriptStartIndex).join("\n").trim()
    : raw.trim()

  return { title, description, script }
}

export interface GenerateOptions {
  sources: SourceInput[]
  speakers?: number       // 1 or 2
  duration?: number        // minutes
  systemPrompt?: string    // custom (already resolved) system prompt
  userTemplate?: string    // custom (already resolved) user template
}

export async function generateScript(options: GenerateOptions): Promise<GenerationResult> {
  const config = await getLLMConfig()

  if (!config.apiKey) {
    throw new Error("Kein API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  const speakers = options.speakers || 2
  const duration = options.duration || 10
  const date = new Date().toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })

  const sourcesText = formatSources(options.sources)

  // If custom prompts provided (already resolved by frontend), use them directly
  // Otherwise resolve from config templates
  let systemPrompt: string
  let userMessage: string

  if (options.systemPrompt) {
    // Custom prompt from frontend - already has speaker_mode etc. resolved
    // Just ensure sources placeholder is resolved in user template
    systemPrompt = options.systemPrompt
    userMessage = options.userTemplate
      ? options.userTemplate.replace(/\{\{sources\}\}/g, sourcesText)
      : resolvePrompt(config.userTemplate, {
          speakers, duration, date,
          voiceName1: config.voiceName1,
          voiceName2: config.voiceName2,
          sources: sourcesText,
        })
  } else {
    systemPrompt = resolvePrompt(config.systemPrompt, {
      speakers, duration, date,
      voiceName1: config.voiceName1,
      voiceName2: config.voiceName2,
    })
    userMessage = resolvePrompt(config.userTemplate, {
      speakers, duration, date,
      voiceName1: config.voiceName1,
      voiceName2: config.voiceName2,
      sources: sourcesText,
    })
  }

  let raw: GenerationResult

  if (config.provider === "anthropic") {
    raw = await generateWithAnthropic(
      { ...config, systemPrompt },
      userMessage
    )
  } else if (config.provider === "openai") {
    raw = await generateWithOpenAI(
      { ...config, systemPrompt },
      userMessage
    )
  } else {
    throw new Error(`Unbekannter Anbieter: ${config.provider}`)
  }

  // Parse response to extract title/description
  const parsed = parseResponse(raw.content)

  return {
    content: parsed.script,
    suggestedTitle: parsed.title,
    suggestedDescription: parsed.description,
    model: raw.model,
    promptTokens: raw.promptTokens,
    outputTokens: raw.outputTokens,
  }
}

async function generateWithAnthropic(
  config: LLMConfig,
  userMessage: string
): Promise<GenerationResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey: config.apiKey })

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 8192,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort vom Modell erhalten")
  }

  return {
    content: textBlock.text,
    suggestedTitle: "",
    suggestedDescription: "",
    model: response.model,
    promptTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

export async function reviseScript(
  currentContent: string,
  instructions: string
): Promise<GenerationResult> {
  const config = await getLLMConfig()

  if (!config.apiKey) {
    throw new Error("Kein API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  const systemMessage = `Du bist ein erfahrener Podcast-Redakteur. Dir wird ein bestehendes Podcast-Skript vorgelegt zusammen mit Anweisungen zur Ueberarbeitung. Setze die Anweisungen um und gib das vollstaendige, ueberarbeitete Skript zurueck.

Wichtig:
- Gib NUR das ueberarbeitete Skript zurueck, keine Erklaerungen oder Kommentare
- Behalte den grundlegenden Aufbau bei, es sei denn, die Anweisungen fordern ausdruecklich eine Umstrukturierung
- Verwende KEINE Markdown-Formatierung
- Schreibe den Text so, wie er vorgelesen werden soll`

  const userMessage = `Hier ist das aktuelle Podcast-Skript:

---SKRIPT ANFANG---
${currentContent}
---SKRIPT ENDE---

Bitte ueberarbeite das Skript nach folgenden Anweisungen:
${instructions}`

  let raw: GenerationResult

  if (config.provider === "anthropic") {
    raw = await generateWithAnthropic({ ...config, systemPrompt: systemMessage }, userMessage)
  } else if (config.provider === "openai") {
    raw = await generateWithOpenAI({ ...config, systemPrompt: systemMessage }, userMessage)
  } else {
    throw new Error(`Unbekannter Anbieter: ${config.provider}`)
  }

  return { ...raw, suggestedTitle: "", suggestedDescription: "" }
}

async function generateWithOpenAI(
  config: LLMConfig,
  userMessage: string
): Promise<GenerationResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 8192,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `OpenAI API Fehler: ${err.error?.message || res.statusText}`
    )
  }

  const data = await res.json()
  const choice = data.choices?.[0]

  if (!choice?.message?.content) {
    throw new Error("Keine Antwort vom OpenAI Modell erhalten")
  }

  return {
    content: choice.message.content,
    suggestedTitle: "",
    suggestedDescription: "",
    model: data.model,
    promptTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  }
}
