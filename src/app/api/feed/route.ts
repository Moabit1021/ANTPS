import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readFile, stat } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatRfc2822(date: Date): string {
  return date.toUTCString()
}

// GET - Public podcast RSS feed
// Optionally authenticated via ?token= for subscriber tracking
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")

  // If a token is provided, log the access
  if (token) {
    const subscriber = await prisma.feedSubscriber.findUnique({
      where: { personalToken: token },
    })
    if (subscriber && subscriber.isActive) {
      await prisma.feedAccessLog.create({
        data: {
          subscriberId: subscriber.id,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent") || null,
          endpoint: "/api/feed",
        },
      })
    }
  }

  // Load feed config
  const feedConfig = await prisma.podcastFeedConfig.findFirst()
  const title = feedConfig?.title || "PodBrief"
  const description = feedConfig?.description || "Newsletter-Podcast"
  const author = feedConfig?.author || "PodBrief"
  const language = feedConfig?.language || "de"
  const imageUrl = feedConfig?.imageUrl || ""

  // Get base URL from headers
  const proto = request.headers.get("x-forwarded-proto") || "https"
  const host = request.headers.get("host") || "localhost:3000"
  const baseUrl = `${proto}://${host}`

  // Fetch published episodes
  const episodes = await prisma.podcastEpisode.findMany({
    where: { status: "PUBLISHED" },
    include: {
      audio: true,
    },
    orderBy: { publishedAt: "desc" },
  })

  // Build episode items
  const items: string[] = []
  for (const ep of episodes) {
    // Get actual file size from disk if possible
    let fileSize = ep.audio.fileSize
    try {
      const fileStat = await stat(path.join(process.cwd(), ep.audio.filePath))
      fileSize = fileStat.size
    } catch {
      // use DB value
    }

    const enclosureUrl = `${baseUrl}/api/feed/audio/${ep.audio.id}`
    const pubDate = ep.publishedAt ? formatRfc2822(ep.publishedAt) : formatRfc2822(ep.createdAt)
    const durationSec = ep.audio.duration
    const durationMin = Math.floor(durationSec / 60)
    const durationRemSec = durationSec % 60
    const itunesDuration = `${durationMin}:${String(durationRemSec).padStart(2, "0")}`

    items.push(`    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${fileSize}" type="audio/mpeg" />
      <guid isPermaLink="false">${ep.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:episode>${ep.episodeNumber}</itunes:episode>
      <itunes:duration>${itunesDuration}</itunes:duration>
      <itunes:author>${escapeXml(author)}</itunes:author>
    </item>`)
  }

  const lastBuildDate = episodes.length > 0 && episodes[0].publishedAt
    ? formatRfc2822(episodes[0].publishedAt)
    : formatRfc2822(new Date())

  const imageTag = imageUrl
    ? `
    <image>
      <url>${escapeXml(imageUrl)}</url>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(baseUrl)}</link>
    </image>
    <itunes:image href="${escapeXml(imageUrl)}" />`
    : ""

  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <link>${escapeXml(baseUrl)}</link>
    <itunes:author>${escapeXml(author)}</itunes:author>
    <itunes:explicit>false</itunes:explicit>${imageTag}
${items.join("\n")}
  </channel>
</rss>`

  return new NextResponse(feedXml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
