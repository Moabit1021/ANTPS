import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendInviteEmail } from "@/lib/email/send"
import crypto from "crypto"

export const dynamic = "force-dynamic"

// GET - List all users (admin only)
export async function GET() {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Also get pending invites
  const invites = await prisma.inviteToken.findMany({
    where: { usedAt: null },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ users, invites })
}

// POST - Invite a new user (admin only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const body = await request.json()
  const { email, expiresInHours = 48 } = body

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  if (existingUser) {
    return NextResponse.json(
      { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
      { status: 409 }
    )
  }

  // Invalidate any existing unused invites for this email
  await prisma.inviteToken.updateMany({
    where: { email: normalizedEmail, usedAt: null },
    data: { usedAt: new Date() }, // Mark as "used" to invalidate
  })

  // Create invite token
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  const invite = await prisma.inviteToken.create({
    data: {
      email: normalizedEmail,
      token,
      expiresAt,
      invitedById: session!.user.id,
    },
  })

  // Send invite email
  const baseUrl = request.headers.get("origin") || request.nextUrl.origin
  try {
    await sendInviteEmail(normalizedEmail, token, baseUrl, expiresAt)
  } catch (err) {
    // Delete the invite if email sending fails
    await prisma.inviteToken.delete({ where: { id: invite.id } })
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden",
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { message: "Einladung gesendet", invite: { id: invite.id, email: normalizedEmail, expiresAt } },
    { status: 201 }
  )
}
