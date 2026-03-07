import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const source = await prisma.source.findUnique({
      where: { id: params.id },
    })

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    return NextResponse.json(source)
  } catch (error) {
    console.error("GET /api/sources/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await prisma.source.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    const body = await req.json()
    const { title, summary, status, rawContent, plainText } = body

    const allowedStatuses = ["NEW", "PROCESSING", "READY", "USED", "ARCHIVED"]
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const data: Record<string, string> = {}
    if (title !== undefined) data.title = title
    if (summary !== undefined) data.summary = summary
    if (status !== undefined) data.status = status
    if (rawContent !== undefined) data.rawContent = rawContent
    if (plainText !== undefined) data.plainText = plainText

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const source = await prisma.source.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(source)
  } catch (error) {
    console.error("PATCH /api/sources/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await prisma.source.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    await prisma.source.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Source deleted" })
  } catch (error) {
    console.error("DELETE /api/sources/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
