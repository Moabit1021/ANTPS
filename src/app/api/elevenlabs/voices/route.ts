import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { listVoices } from "@/lib/elevenlabs"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  // Allow passing API key as query param for testing before saving
  const { searchParams } = request.nextUrl
  let apiKey = searchParams.get("apiKey") || ""

  if (!apiKey) {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "elevenlabs_api_key" },
    })
    apiKey = setting?.value || ""
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Kein ElevenLabs API-Schluessel konfiguriert." },
      { status: 400 }
    )
  }

  try {
    const voices = await listVoices(apiKey)
    return NextResponse.json({ voices })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Stimmen" },
      { status: 500 }
    )
  }
}
