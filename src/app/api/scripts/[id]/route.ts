import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params

  const script = await prisma.podcastScript.findUnique({
    where: { id },
    include: {
      sources: {
        include: {
          source: { select: { id: true, title: true, type: true } },
        },
      },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!script) {
    return NextResponse.json({ error: "Skript nicht gefunden" }, { status: 404 })
  }

  // Build version chain: find root, then collect all versions
  let rootId = script.id
  let current = script
  // Walk up to root
  while (current.parentId) {
    const parent = await prisma.podcastScript.findUnique({
      where: { id: current.parentId },
      select: { id: true, parentId: true },
    })
    if (!parent) break
    rootId = parent.id
    current = parent as typeof current
  }

  // Find all scripts in this version chain
  const allScripts = await prisma.podcastScript.findMany({
    where: {
      OR: [
        { id: rootId },
        { parentId: rootId },
      ],
    },
    select: {
      id: true,
      version: true,
      status: true,
      createdAt: true,
      config: true,
    },
    orderBy: { version: "asc" },
  })

  // For deeper chains (>2 levels), also find children of children
  if (allScripts.length > 0) {
    const ids = allScripts.map((s) => s.id)
    const deeper = await prisma.podcastScript.findMany({
      where: {
        parentId: { in: ids },
        id: { notIn: ids },
      },
      select: {
        id: true,
        version: true,
        status: true,
        createdAt: true,
        config: true,
      },
      orderBy: { version: "asc" },
    })
    allScripts.push(...deeper)
    allScripts.sort((a, b) => a.version - b.version)
  }

  return NextResponse.json({ ...script, versions: allScripts })
}

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

  const allowedFields: Record<string, unknown> = {}
  if ("title" in body) allowedFields.title = body.title
  if ("content" in body) allowedFields.content = body.content
  if ("status" in body) allowedFields.status = body.status

  const script = await prisma.podcastScript.update({
    where: { id },
    data: allowedFields,
    include: {
      sources: {
        include: {
          source: { select: { id: true, title: true, type: true } },
        },
      },
    },
  })

  return NextResponse.json(script)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = request.nextUrl
  const mode = searchParams.get("mode") // "single" or "all" (default: "all")

  if (mode === "single") {
    // Delete only this single version, re-link children to parent
    const script = await prisma.podcastScript.findUnique({
      where: { id },
      select: { parentId: true },
    })
    if (script) {
      // Point any children of this script to this script's parent
      await prisma.podcastScript.updateMany({
        where: { parentId: id },
        data: { parentId: script.parentId },
      })
    }
    await prisma.podcastScript.delete({ where: { id } })
  } else {
    // Delete this script and all versions in the chain
    // First find the root
    let rootId = id
    let current = await prisma.podcastScript.findUnique({
      where: { id },
      select: { parentId: true },
    })
    while (current?.parentId) {
      rootId = current.parentId
      current = await prisma.podcastScript.findUnique({
        where: { id: rootId },
        select: { parentId: true },
      })
    }

    // Collect all IDs in the version chain
    const allIds = new Set<string>([rootId])
    let frontier = [rootId]
    while (frontier.length > 0) {
      const children = await prisma.podcastScript.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      })
      frontier = children.map((c) => c.id).filter((cid) => !allIds.has(cid))
      frontier.forEach((cid) => allIds.add(cid))
    }

    // Delete all scripts in the chain (cascades handle audio/episodes)
    await prisma.podcastScript.deleteMany({
      where: { id: { in: Array.from(allIds) } },
    })
  }

  return NextResponse.json({ success: true })
}
