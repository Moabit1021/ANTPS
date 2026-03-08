import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  const script = await prisma.podcastScript.findUnique({
    where: { id },
    include: {
      sources: {
        include: {
          source: { select: { id: true, title: true, type: true } },
        },
      },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!script) {
    return NextResponse.json({ error: "Skript nicht gefunden" }, { status: 404 })
  }

  return NextResponse.json(script)
}

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

  const allowedFields: Record<string, unknown> = {}
  if ("title" in body) allowedFields.title = body.title
  if ("content" in body) allowedFields.content = body.content
  if ("status" in body) allowedFields.status = body.status

  const script = await prisma.podcastScript.update({
    where: { id },
    data: allowedFields,
    include: {
      sources: {
        include: {
          source: { select: { id: true, title: true, type: true } },
        },
      },
    },
  })

  return NextResponse.json(script)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  await prisma.podcastScript.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
