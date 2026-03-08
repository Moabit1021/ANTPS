import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// POST - Register with invite token (public)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, name, password } = body

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token und Passwort sind erforderlich" },
      { status: 400 }
    )
  }

  // Password strength validation
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen lang sein" },
      { status: 400 }
    )
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Das Passwort muss Gross- und Kleinbuchstaben sowie Zahlen enthalten" },
      { status: 400 }
    )
  }

  // Verify token
  const invite = await prisma.inviteToken.findUnique({
    where: { token },
  })

  if (!invite) {
    return NextResponse.json({ error: "Ungueltiger Einladungslink" }, { status: 404 })
  }

  if (invite.usedAt) {
    return NextResponse.json(
      { error: "Dieser Einladungslink wurde bereits verwendet" },
      { status: 410 }
    )
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Dieser Einladungslink ist abgelaufen" },
      { status: 410 }
    )
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  })
  if (existingUser) {
    // Mark invite as used
    await prisma.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })
    return NextResponse.json(
      { error: "Ein Konto mit dieser E-Mail existiert bereits. Bitte melden Sie sich an." },
      { status: 409 }
    )
  }

  // Create user and mark invite as used in a transaction
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name: name || null,
        passwordHash,
        role: "CREATOR",
      },
    }),
    prisma.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json(
    { message: "Konto erfolgreich erstellt. Sie koennen sich jetzt anmelden." },
    { status: 201 }
  )
}
