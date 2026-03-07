import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const sort = searchParams.get("sort") === "asc" ? "asc" : "desc"

    const where: Record<string, string> = {}
    if (type) where.type = type
    if (status) where.status = status

    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where,
        orderBy: { receivedAt: sort },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.source.count({ where }),
    ])

    return NextResponse.json({ sources, total, page, limit })
  } catch (error) {
    console.error("GET /api/sources error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { type, title, rawContent, plainText, senderEmail, senderName, summary, filePath, receivedAt } = body

    if (!type || !title || !rawContent || !plainText) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, rawContent, plainText" },
        { status: 400 }
      )
    }

    const validTypes = ["NEWSLETTER", "PDF_UPLOAD", "MANUAL_TEXT"]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      )
    }

    const source = await prisma.source.create({
      data: {
        type,
        title,
        rawContent,
        plainText,
        senderEmail: senderEmail || null,
        senderName: senderName || null,
        summary: summary || null,
        filePath: filePath || null,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      },
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    console.error("POST /api/sources error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
