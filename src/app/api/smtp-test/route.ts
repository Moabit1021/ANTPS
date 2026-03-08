import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, requireAdmin } from "@/lib/auth"
import { testSmtpConnection } from "@/lib/email/send"

export const dynamic = "force-dynamic"

// POST - Test SMTP connection (admin only)
export async function POST() {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const result = await testSmtpConnection()

  if (result.success) {
    return NextResponse.json({ message: "SMTP-Verbindung erfolgreich" })
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
}
