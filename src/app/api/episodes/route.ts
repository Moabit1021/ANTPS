import { NextRequest, NextResponse } from "next/server"
import { requireAuth, userScope } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET - List episodes
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get("status")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  const scope = userScope(user)
  const where: Record<string, unknown> = { ...scope }
  if (status) where.status = status as "DRAFT" | "PUBLISHED" | "UNPUBLISHED"

  const [episodes, total] = await Promise.all([
    prisma.podcastEpisode.findMany({
      where,
      include: {
        audio: {
          include: {
            script: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.podcastEpisode.count({ where }),
  ])

  return NextResponse.json({ episodes, total })
}

// POST - Create episode from audio
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const body = await request.json()
  const { audioId, title, description } = body

  if (!audioId) {
    return NextResponse.json({ error: "audioId ist erforderlich" }, { status: 400 })
  }

  // Check audio exists and has no episode yet
  const audio = await prisma.podcastAudio.findUnique({
    where: { id: audioId },
    include: { episode: true, script: { select: { title: true } } },
  })

  if (!audio) {
    return NextResponse.json({ error: "Audio nicht gefunden" }, { status: 404 })
  }

  // Check ownership for non-admins
  if (user.role !== "ADMIN" && audio.userId && audio.userId !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
  }

  if (audio.episode) {
    return NextResponse.json({ error: "Dieses Audio hat bereits eine Episode" }, { status: 409 })
  }

  // Get next episode number
  const lastEpisode = await prisma.podcastEpisode.findFirst({
    orderBy: { episodeNumber: "desc" },
  })
  const episodeNumber = (lastEpisode?.episodeNumber ?? 0) + 1

  const episode = await prisma.podcastEpisode.create({
    data: {
      audioId,
      title: title || audio.script.title || `Episode ${episodeNumber}`,
      description: description || "",
      episodeNumber,
      userId: user.id,
    },
    include: {
      audio: {
        include: {
          script: { select: { id: true, title: true } },
        },
      },
    },
  })

  return NextResponse.json(episode, { status: 201 })
}
