import { NextRequest, NextResponse } from "next/server"
import { requireAuth, userScope } from "@/lib/auth-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const scope = userScope(user)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sourceWhere = { ...scope }
  const scriptWhere = scope.userId ? { userId: scope.userId } : {}
  const audioWhere = scope.userId ? { userId: scope.userId } : {}
  const episodeWhere = scope.userId ? { userId: scope.userId } : {}

  const [
    newSourcesToday,
    totalSources,
    draftScripts,
    totalScripts,
    totalAudio,
    publishedEpisodes,
    totalEpisodes,
    totalAutomations,
    recentSources,
    recentScripts,
    recentAudio,
    recentEpisodes,
  ] = await Promise.all([
    prisma.source.count({ where: { ...sourceWhere, createdAt: { gte: today } } }),
    prisma.source.count({ where: sourceWhere }),
    prisma.podcastScript.count({ where: { ...scriptWhere, status: { in: ["DRAFT", "REVISING"] } } }),
    prisma.podcastScript.count({ where: scriptWhere }),
    prisma.podcastAudio.count({ where: { ...audioWhere, status: "COMPLETED" } }),
    prisma.podcastEpisode.count({ where: { ...episodeWhere, status: "PUBLISHED" } }),
    prisma.podcastEpisode.count({ where: episodeWhere }),
    prisma.automationRule.count({ where: scope.userId ? { userId: scope.userId, isActive: true } : { isActive: true } }),
    prisma.source.findMany({
      where: sourceWhere,
      select: { id: true, title: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.podcastScript.findMany({
      where: scriptWhere,
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.podcastAudio.findMany({
      where: audioWhere,
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
      where: episodeWhere,
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
      totalAutomations,
    },
    activities: activities.slice(0, 10),
  })
}
