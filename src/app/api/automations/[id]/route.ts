import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/automations/[id] - Get a single automation rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const { id } = await params

  const rule = await prisma.automationRule.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  })

  if (!rule) {
    return NextResponse.json({ error: "Automation nicht gefunden" }, { status: 404 })
  }

  if (user.role !== "ADMIN" && rule.userId !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
  }

  return NextResponse.json(rule)
}

/**
 * PUT /api/automations/[id] - Update an automation rule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const { id } = await params

  const rule = await prisma.automationRule.findUnique({ where: { id } })
  if (!rule) {
    return NextResponse.json({ error: "Automation nicht gefunden" }, { status: 404 })
  }

  if (user.role !== "ADMIN" && rule.userId !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
  }

  const body = await request.json()
  const { name, isActive, schedule, sourceFilter, topicFilter, speakers, duration, autoPublish } = body

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.trim()
  if (isActive !== undefined) updateData.isActive = isActive
  if (schedule !== undefined) {
    const parts = schedule.trim().split(/\s+/)
    if (parts.length !== 5) {
      return NextResponse.json(
        { error: "Ungültiger Cron-Ausdruck" },
        { status: 400 }
      )
    }
    updateData.schedule = schedule.trim()
  }
  if (sourceFilter !== undefined) updateData.sourceFilter = sourceFilter
  if (topicFilter !== undefined) updateData.topicFilter = topicFilter?.trim() || null
  if (speakers !== undefined) updateData.speakers = speakers
  if (duration !== undefined) updateData.duration = duration
  if (autoPublish !== undefined) updateData.autoPublish = autoPublish

  const updated = await prisma.automationRule.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(updated)
}

/**
 * DELETE /api/automations/[id] - Delete an automation rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const { id } = await params

  const rule = await prisma.automationRule.findUnique({ where: { id } })
  if (!rule) {
    return NextResponse.json({ error: "Automation nicht gefunden" }, { status: 404 })
  }

  if (user.role !== "ADMIN" && rule.userId !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
  }

  await prisma.automationRule.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
