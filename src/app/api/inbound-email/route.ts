import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { convert } from "html-to-text"

export const dynamic = "force-dynamic"

// Shared secret for authenticating the mailserver webhook
function validateWebhookSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-webhook-secret")
  const expectedSecret = process.env.INBOUND_EMAIL_SECRET
  if (!expectedSecret) {
    console.error("[Inbound Email] INBOUND_EMAIL_SECRET not configured")
    return false
  }
  return secret === expectedSecret
}

/**
 * POST /api/inbound-email
 * Webhook endpoint called by the mailserver when an email arrives.
 * Extracts the user's inbox alias from the To address and creates a Source.
 */
export async function POST(request: NextRequest) {
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      from,
      to,
      subject,
      html,
      text,
      messageId,
    } = body as {
      from: string
      to: string
      subject: string
      html?: string
      text?: string
      messageId?: string
    }

    if (!to || !from) {
      return NextResponse.json({ error: "Missing required fields: from, to" }, { status: 400 })
    }

    // Extract alias from To address (e.g., "u-a8f3k2@inbox.podbriefapp.com" → "u-a8f3k2")
    const aliasMatch = to.match(/^<?([^@<]+)@/)
    if (!aliasMatch) {
      return NextResponse.json({ error: "Invalid To address format" }, { status: 400 })
    }
    const alias = aliasMatch[1].trim().toLowerCase()

    // Find user by inbox alias
    const user = await prisma.user.findFirst({
      where: { inboxAlias: alias, isActive: true },
    })

    if (!user) {
      console.warn(`[Inbound Email] No user found for alias: ${alias}`)
      // Return 200 to prevent the mailserver from retrying
      return NextResponse.json({ status: "ignored", reason: "unknown_alias" })
    }

    // Check for duplicate message
    if (messageId) {
      const existing = await prisma.source.findUnique({
        where: { messageId },
      })
      if (existing) {
        return NextResponse.json({ status: "duplicate", sourceId: existing.id })
      }
    }

    // Parse sender info
    const senderMatch = from.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/)
    const senderName = senderMatch?.[1]?.trim() || null
    const senderEmail = senderMatch?.[2]?.trim() || from.trim()

    // Convert HTML to plain text
    const plainText = text || (html ? convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
      ],
    }) : "")

    // Create source
    const source = await prisma.source.create({
      data: {
        type: "NEWSLETTER",
        title: subject || "Kein Betreff",
        senderEmail,
        senderName,
        receivedAt: new Date(),
        rawContent: html || text || "",
        plainText,
        messageId: messageId || undefined,
        status: "NEW",
        userId: user.id,
      },
    })

    // Queue embedding generation (async, don't block response)
    try {
      const { embedSource } = await import("@/lib/embeddings")
      embedSource(source.id).catch(err =>
        console.error(`[Inbound Email] Embedding generation failed for ${source.id}:`, err)
      )
    } catch {
      // Embedding generation is optional, don't fail the webhook
    }

    console.log(`[Inbound Email] Created source ${source.id} for user ${user.email} from ${senderEmail}`)

    return NextResponse.json({ status: "created", sourceId: source.id })
  } catch (error) {
    console.error("[Inbound Email] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
