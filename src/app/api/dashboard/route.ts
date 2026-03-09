import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    newSourcesToday,
    totalSources,
    draftScripts,
    totalScripts,
    totalAudio,
    publishedEpisodes,
    totalEpisodes,
    recentSources,
    recentScripts,
    recentAudio,
    recentEpisodes,
  ] = await Promise.all([
    prisma.source.count({ where: { createdAt: { gte: today } } }),
    prisma.source.count(),
    prisma.podcastScript.count({ where: { status: { in: ["DRAFT", "REVISING"] } } }),
    prisma.podcastScript.count(),
    prisma.podcastAudio.count({ where: { status: "COMPLETED" } }),
    prisma.podcastEpisode.count({ where: { status: "PUBLISHED" } }),
    prisma.podcastEpisode.count(),
    prisma.source.findMany({
      select: { id: true, title: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.podcastScript.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.podcastAudio.findMany({
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        script: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.podcastEpisode.findMany({
      select: { id: true, title: true, status: true, publishedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  // Build activity feed from recent items
  type Activity = { type: string; title: string; date: string; id: string; status?: string }
  const activities: Activity[] = []

  for (const s of recentSources) {
    activities.push({
      type: "source",
      title: s.title,
      date: s.createdAt.toISOString(),
      id: s.id,
    })
  }
  for (const s of recentScripts) {
    activities.push({
      type: "script",
      title: s.title,
      date: s.createdAt.toISOString(),
      id: s.id,
      status: s.status,
    })
  }
  for (const a of recentAudio) {
    activities.push({
      type: "audio",
      title: a.script?.title || a.fileName,
      date: a.createdAt.toISOString(),
      id: a.id,
      status: a.status,
    })
  }
  for (const e of recentEpisodes) {
    activities.push({
      type: "episode",
      title: e.title,
      date: (e.publishedAt || e.createdAt).toISOString(),
      id: e.id,
      status: e.status,
    })
  }

  // Sort by date descending and take top 10
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({
    stats: {
      newSourcesToday,
      totalSources,
      draftScripts,
      totalScripts,
      totalAudio,
      publishedEpisodes,
      totalEpisodes,
    },
    activities: activities.slice(0, 10),
  })
}
