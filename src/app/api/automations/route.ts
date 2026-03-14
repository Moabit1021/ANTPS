import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/automations - List user's automation rules
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const rules = await prisma.automationRule.findMany({
    where: user.role === "ADMIN" ? {} : { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
    },
  })

  return NextResponse.json(rules)
}

/**
 * POST /api/automations - Create a new automation rule
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const body = await request.json()

  const { name, schedule, sourceFilter, topicFilter, speakers, duration, autoPublish } = body as {
    name: string
    schedule: string
    sourceFilter?: { senders?: string[]; types?: string[] }
    topicFilter?: string
    speakers?: number
    duration?: number
    autoPublish?: boolean
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 })
  }

  if (!schedule?.trim()) {
    return NextResponse.json({ error: "Zeitplan ist erforderlich" }, { status: 400 })
  }

  // Basic cron validation
  const cronParts = schedule.trim().split(/\s+/)
  if (cronParts.length !== 5) {
    return NextResponse.json(
      { error: "Ungültiger Cron-Ausdruck (5 Felder erwartet: Min Std Tag Mon Wtag)" },
      { status: 400 }
    )
  }

  const rule = await prisma.automationRule.create({
    data: {
      userId: user.id,
      name: name.trim(),
      schedule: schedule.trim(),
      sourceFilter: sourceFilter || undefined,
      topicFilter: topicFilter?.trim() || null,
      speakers: speakers || 2,
      duration: duration || 10,
      autoPublish: autoPublish || false,
    },
  })

  return NextResponse.json(rule, { status: 201 })
}
