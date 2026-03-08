import { prisma } from "@/lib/prisma"

// Default prompts (same as in settings API)
const DEFAULT_SYSTEM_PROMPT = `Du bist ein erfahrener Podcast-Redakteur. Deine Aufgabe ist es, aus Newsletter-Inhalten ein unterhaltsames und informatives Podcast-Skript zu erstellen.

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
- Schreibe den Text so, wie er vorgelesen werden soll`

const DEFAULT_USER_TEMPLATE = `Erstelle ein Podcast-Skript basierend auf den folgenden Newsletter-Quellen:

{{sources}}

Erstelle daraus ein zusammenhaengendes, unterhaltsames Podcast-Skript.`

interface LLMConfig {
  provider: string
  apiKey: string
  model: string
  systemPrompt: string
  userTemplate: string
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

interface GenerationResult {
  content: string
  model: string
  promptTokens: number
  outputTokens: number
}

export async function generateScript(sources: SourceInput[]): Promise<GenerationResult> {
  const config = await getLLMConfig()

  if (!config.apiKey) {
    throw new Error("Kein API-Schluessel konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }

  const sourcesText = formatSources(sources)
  const userMessage = config.userTemplate.replace("{{sources}}", sourcesText)

  if (config.provider === "anthropic") {
    return generateWithAnthropic(config, userMessage)
  } else if (config.provider === "openai") {
    return generateWithOpenAI(config, userMessage)
  } else {
    throw new Error(`Unbekannter Anbieter: ${config.provider}`)
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
    model: response.model,
    promptTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function generateWithOpenAI(
  config: LLMConfig,
  userMessage: string
): Promise<GenerationResult> {
  // Use fetch to call OpenAI API directly (no extra dependency needed)
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
    model: data.model,
    promptTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  }
}
