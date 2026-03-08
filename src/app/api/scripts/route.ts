import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20))
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (status && status !== "ALL") {
    where.status = status
  }

  const [scripts, total] = await Promise.all([
    prisma.podcastScript.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sources: {
          include: {
            source: {
              select: { id: true, title: true, type: true },
            },
          },
        },
      },
    }),
    prisma.podcastScript.count({ where }),
  ])

  return NextResponse.json({
    scripts,
    total,
    page,
    limit,
  })
}
