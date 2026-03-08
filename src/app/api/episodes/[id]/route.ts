import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET - Single episode
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  const episode = await prisma.podcastEpisode.findUnique({
    where: { id },
    include: {
      audio: {
        include: {
          script: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!episode) {
    return NextResponse.json({ error: "Episode nicht gefunden" }, { status: 404 })
  }

  return NextResponse.json(episode)
}

// PATCH - Update episode (title, description, status)
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

  const episode = await prisma.podcastEpisode.findUnique({ where: { id } })
  if (!episode) {
    return NextResponse.json({ error: "Episode nicht gefunden" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description

  // Handle status transitions
  if (body.status !== undefined) {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["PUBLISHED"],
      PUBLISHED: ["UNPUBLISHED"],
      UNPUBLISHED: ["PUBLISHED", "DRAFT"],
    }

    const allowed = validTransitions[episode.status] || []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Übergang von ${episode.status} zu ${body.status} nicht erlaubt` },
        { status: 400 }
      )
    }

    data.status = body.status

    // Set publishedAt when first published
    if (body.status === "PUBLISHED" && !episode.publishedAt) {
      data.publishedAt = new Date()
    }
  }

  const updated = await prisma.podcastEpisode.update({
    where: { id },
    data,
    include: {
      audio: {
        include: {
          script: { select: { id: true, title: true } },
        },
      },
    },
  })

  return NextResponse.json(updated)
}

// DELETE - Remove episode
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  await prisma.podcastEpisode.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
