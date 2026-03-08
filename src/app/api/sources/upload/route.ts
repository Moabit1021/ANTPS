import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = (formData.get("title") as string) || ""

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Nur PDF-Dateien erlaubt" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Extract text from PDF
    let plainText = ""
    try {
      // Use pdf-parse/lib/pdf-parse.js directly to avoid the test-file-loading index.js wrapper
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js")
      const pdfData = await pdfParse(buffer)
      plainText = pdfData.text
    } catch (pdfError) {
      console.error("PDF parse error:", pdfError)
      return NextResponse.json({ error: "PDF konnte nicht gelesen werden" }, { status: 400 })
    }

    // Save file to disk
    const dataDir = process.env.DATA_DIR || "./data"
    const uploadsDir = join(dataDir, "uploads")
    await mkdir(uploadsDir, { recursive: true })

    const id = crypto.randomUUID()
    const filePath = join(uploadsDir, `${id}.pdf`)
    await writeFile(filePath, buffer)

    // Create source entry
    const source = await prisma.source.create({
      data: {
        type: "PDF_UPLOAD",
        title: title || file.name.replace(/\.pdf$/i, ""),
        receivedAt: new Date(),
        rawContent: plainText,
        plainText,
        filePath,
        status: "NEW",
      },
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 })
  }
}
