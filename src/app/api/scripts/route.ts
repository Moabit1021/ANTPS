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

  // Only return root scripts (parentId is null) - these represent script "families"
  const where: Record<string, unknown> = { parentId: null }
  if (status && status !== "ALL") {
    // For status filter, we want to match if any version in the chain has this status
    // But for simplicity, we filter the latest version's status
    delete where.parentId
  }

  if (status && status !== "ALL") {
    // Get all root scripts, then filter by latest version status
    const allRoots = await prisma.podcastScript.findMany({
      where: { parentId: null },
      select: { id: true },
    })
    const rootIds = allRoots.map((r) => r.id)

    // For each root, find the latest version (highest version number)
    // and check if it matches the status filter
    const allScripts = await prisma.podcastScript.findMany({
      where: {
        OR: [
          { id: { in: rootIds } },
          { parentId: { in: rootIds } },
        ],
      },
      select: { id: true, parentId: true, version: true, status: true },
    })

    // Also find deeper children
    let allIds = allScripts.map((s) => s.id)
    let frontier = allIds
    let deeperScripts = allScripts
    for (let i = 0; i < 5; i++) {
      const children = await prisma.podcastScript.findMany({
        where: { parentId: { in: frontier }, id: { notIn: allIds } },
        select: { id: true, parentId: true, version: true, status: true },
      })
      if (children.length === 0) break
      deeperScripts = [...deeperScripts, ...children]
      frontier = children.map((c) => c.id)
      allIds = [...allIds, ...frontier]
    }

    // Group by root and find latest version's status
    const rootToLatestStatus = new Map<string, string>()
    for (const s of deeperScripts) {
      // Find root for this script
      let rid = s.parentId === null ? s.id : s.parentId
      // Walk up if needed
      let found = deeperScripts.find((x) => x.id === rid)
      while (found && found.parentId) {
        rid = found.parentId
        found = deeperScripts.find((x) => x.id === rid)
      }
      const currentVersion = rootToLatestStatus.get(rid!)
        ? deeperScripts.find((x) => x.id === rid && x.version > s.version)
          ? undefined
          : s.status
        : s.status
      if (!rootToLatestStatus.has(rid!) || s.version > (deeperScripts.find((x) => x.status === rootToLatestStatus.get(rid!))?.version ?? 0)) {
        rootToLatestStatus.set(rid!, s.status)
      }
    }

    const matchingRootIds = Array.from(rootToLatestStatus.entries())
      .filter(([, s]) => s === status)
      .map(([id]) => id)

    const total = matchingRootIds.length
    const paginatedIds = matchingRootIds.slice((page - 1) * limit, page * limit)

    const roots = await prisma.podcastScript.findMany({
      where: { id: { in: paginatedIds } },
      orderBy: { createdAt: "desc" },
      include: {
        sources: {
          include: {
            source: { select: { id: true, title: true, type: true } },
          },
        },
      },
    })

    // Enrich with version info
    const enriched = await enrichWithVersionInfo(roots)

    return NextResponse.json({ scripts: enriched, total, page, limit })
  }

  // Default: get root scripts
  const [roots, total] = await Promise.all([
    prisma.podcastScript.findMany({
      where: { parentId: null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sources: {
          include: {
            source: { select: { id: true, title: true, type: true } },
          },
        },
      },
    }),
    prisma.podcastScript.count({ where: { parentId: null } }),
  ])

  const enriched = await enrichWithVersionInfo(roots)

  return NextResponse.json({ scripts: enriched, total, page, limit })
}

async function enrichWithVersionInfo(
  roots: Array<{
    id: string
    title: string
    version: number
    status: string
    createdAt: Date
    updatedAt: Date
    [key: string]: unknown
  }>
) {
  if (roots.length === 0) return roots

  const rootIds = roots.map((r) => r.id)

  // Find all children of these roots (recursively)
  let allChildren: Array<{ id: string; parentId: string | null; version: number; status: string; createdAt: Date; updatedAt: Date }> = []
  let frontier = rootIds
  for (let i = 0; i < 10; i++) {
    const children = await prisma.podcastScript.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, parentId: true, version: true, status: true, createdAt: true, updatedAt: true },
    })
    if (children.length === 0) break
    allChildren = [...allChildren, ...children]
    frontier = children.map((c) => c.id)
  }

  // Group children by root
  const childByRoot = new Map<string, typeof allChildren>()
  for (const child of allChildren) {
    // Walk up to find root
    let rootId = child.parentId
    while (rootId && !rootIds.includes(rootId)) {
      const parent = allChildren.find((c) => c.id === rootId)
      rootId = parent?.parentId ?? null
    }
    if (rootId) {
      const existing = childByRoot.get(rootId) || []
      existing.push(child)
      childByRoot.set(rootId, existing)
    }
  }

  return roots.map((root) => {
    const children = childByRoot.get(root.id) || []
    const allVersions = [root, ...children]
    const versionCount = allVersions.length
    const latestVersion = allVersions.reduce((latest, v) =>
      v.version > latest.version ? v : latest, root
    )
    const latestDate = allVersions.reduce((latest, v) =>
      new Date(v.createdAt) > new Date(latest.createdAt) ? v : latest, root
    )

    return {
      ...root,
      versionCount,
      latestVersionId: latestVersion.id,
      latestVersion: latestVersion.version,
      latestStatus: latestVersion.status,
      latestDate: latestDate.createdAt,
    }
  })
}
