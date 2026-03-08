import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// DELETE - Revoke a pending invite (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const { id } = await params

  await prisma.inviteToken.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
