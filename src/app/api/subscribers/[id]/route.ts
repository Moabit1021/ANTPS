import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// PATCH - Update subscriber (toggle active, update name/note)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const subscriber = await prisma.feedSubscriber.findUnique({ where: { id } })
  if (!subscriber) {
    return NextResponse.json({ error: "Abonnent nicht gefunden" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name || null
  if (body.note !== undefined) data.note = body.note || null
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

  const updated = await prisma.feedSubscriber.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}

// DELETE - Remove subscriber
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  await prisma.feedSubscriber.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
