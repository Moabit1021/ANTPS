import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// PUT - Update user role or status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const adminError = requireAdmin(session)
  if (adminError) {
    return NextResponse.json({ error: adminError.error }, { status: adminError.status })
  }

  const { id } = await params
  const body = await request.json()
  const { role, isActive } = body

  // Prevent admin from deactivating themselves
  if (id === session!.user.id && isActive === false) {
    return NextResponse.json(
      { error: "Sie koennen Ihr eigenes Konto nicht deaktivieren" },
      { status: 400 }
    )
  }

  // Prevent admin from changing their own role
  if (id === session!.user.id && role && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Sie koennen Ihre eigene Rolle nicht aendern" },
      { status: 400 }
    )
  }

  const updateData: { role?: "ADMIN" | "CREATOR"; isActive?: boolean } = {}
  if (role && (role === "ADMIN" || role === "CREATOR")) {
    updateData.role = role
  }
  if (typeof isActive === "boolean") {
    updateData.isActive = isActive
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Aenderungen angegeben" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  })

  return NextResponse.json(user)
}

// DELETE - Delete a user (admin only)
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

  // Prevent admin from deleting themselves
  if (id === session!.user.id) {
    return NextResponse.json(
      { error: "Sie koennen Ihr eigenes Konto nicht loeschen" },
      { status: 400 }
    )
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
