import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getLLMConfig, getDefaultPrompts } from "@/lib/llm"

export const dynamic = "force-dynamic"

// GET - Get prompt templates and voice names (any authenticated user)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const config = await getLLMConfig()
  const defaults = getDefaultPrompts()

  return NextResponse.json({
    systemPrompt: config.systemPrompt,
    userTemplate: config.userTemplate,
    voiceName1: config.voiceName1,
    voiceName2: config.voiceName2,
    speakerModeMonolog: defaults.speakerModeMonolog,
    speakerModeDialog: defaults.speakerModeDialog,
  })
}
