import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET - List subscribers
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  const [subscribers, total] = await Promise.all([
    prisma.feedSubscriber.findMany({
      include: {
        _count: { select: { accessLogs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.feedSubscriber.count(),
  ])

  return NextResponse.json({ subscribers, total })
}

// POST - Create subscriber
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()
  const { email, name, note } = body

  if (!email) {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 })
  }

  // Check for existing subscriber
  const existing = await prisma.feedSubscriber.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Ein Abonnent mit dieser E-Mail existiert bereits" }, { status: 409 })
  }

  const subscriber = await prisma.feedSubscriber.create({
    data: {
      email,
      name: name || null,
      note: note || null,
    },
  })

  return NextResponse.json(subscriber, { status: 201 })
}
