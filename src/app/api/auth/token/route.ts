import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/token - Generate a new API token for mobile app authentication
 * Returns the raw token once. The hash is stored in the database.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  // Generate a secure random token
  const rawToken = `pb_${crypto.randomBytes(32).toString("hex")}`

  // Hash it for storage
  const hash = await bcrypt.hash(rawToken, 10)

  // Store the hash
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: hash },
  })

  return NextResponse.json({
    token: rawToken,
    message: "Token wurde erstellt. Speichern Sie ihn sicher - er wird nicht erneut angezeigt.",
  })
}

/**
 * DELETE /api/auth/token - Revoke the current API token
 */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: null },
  })

  return NextResponse.json({ success: true })
}
