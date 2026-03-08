import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET - Read feed configuration
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  let config = await prisma.podcastFeedConfig.findFirst()

  if (!config) {
    config = await prisma.podcastFeedConfig.create({
      data: {},
    })
  }

  return NextResponse.json(config)
}

// PUT - Update feed configuration
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()

  let config = await prisma.podcastFeedConfig.findFirst()

  if (!config) {
    config = await prisma.podcastFeedConfig.create({
      data: {
        title: body.title || "PodBrief",
        description: body.description || "",
        author: body.author || "PodBrief",
        language: body.language || "de",
        imageUrl: body.imageUrl || null,
      },
    })
  } else {
    config = await prisma.podcastFeedConfig.update({
      where: { id: config.id },
      data: {
        title: body.title ?? config.title,
        description: body.description ?? config.description,
        author: body.author ?? config.author,
        language: body.language ?? config.language,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl || null : config.imageUrl,
      },
    })
  }

  return NextResponse.json(config)
}
