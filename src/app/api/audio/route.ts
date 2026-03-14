import { NextRequest, NextResponse } from "next/server"
import { requireAuth, userScope } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20))

  const scope = userScope(user)
  const where = scope.userId ? { userId: scope.userId } : {}

  const [audios, total] = await Promise.all([
    prisma.podcastAudio.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        script: { select: { id: true, title: true } },
        episode: { select: { id: true } },
      },
    }),
    prisma.podcastAudio.count({ where }),
  ])

  return NextResponse.json({ audios, total, page, limit })
}
