import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * GET /api/me - Get current user profile including inbox address
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      inboxAlias: true,
      apiTokenHash: true,
      createdAt: true,
      lastLoginAt: true,
    },
  })

  if (!dbUser) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 })
  }

  // Get inbox domain from settings or env
  const inboxDomain = process.env.INBOX_DOMAIN || "inbox.podbriefapp.com"

  return NextResponse.json({
    ...dbUser,
    apiTokenHash: undefined,
    hasApiToken: !!dbUser.apiTokenHash,
    inboxEmail: dbUser.inboxAlias ? `${dbUser.inboxAlias}@${inboxDomain}` : null,
    inboxDomain,
  })
}

/**
 * PUT /api/me - Update profile (name) and generate inbox alias if missing
 */
export async function PUT(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const body = await request.json()
  const { name, generateInbox } = body as { name?: string; generateInbox?: boolean }

  const updateData: Record<string, string> = {}

  if (name !== undefined) {
    updateData.name = name.trim()
  }

  // Generate inbox alias if requested and not already set
  if (generateInbox) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { inboxAlias: true },
    })

    if (!dbUser?.inboxAlias) {
      // Generate a unique alias: u-<8 random chars>
      let alias: string
      let attempts = 0
      do {
        alias = `u-${crypto.randomBytes(4).toString("hex")}`
        const existing = await prisma.user.findFirst({ where: { inboxAlias: alias } })
        if (!existing) break
        attempts++
      } while (attempts < 10)

      updateData.inboxAlias = alias
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      inboxAlias: true,
    },
  })

  const inboxDomain = process.env.INBOX_DOMAIN || "inbox.podbriefapp.com"

  return NextResponse.json({
    ...updated,
    inboxEmail: updated.inboxAlias ? `${updated.inboxAlias}@${inboxDomain}` : null,
  })
}
