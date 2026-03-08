import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET - Verify an invite token (public)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token fehlt" }, { status: 400 })
  }

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
  })

  if (!invite) {
    return NextResponse.json({ error: "Ungueltiger Einladungslink" }, { status: 404 })
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: "Dieser Einladungslink wurde bereits verwendet" }, { status: 410 })
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Dieser Einladungslink ist abgelaufen" }, { status: 410 })
  }

  return NextResponse.json({ email: invite.email, expiresAt: invite.expiresAt })
}
