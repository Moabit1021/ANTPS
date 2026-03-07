import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { convert } from "html-to-text"
import { prisma } from "@/lib/prisma"

export async function pollEmails(): Promise<number> {
  const host = process.env.IMAP_HOST
  const port = parseInt(process.env.IMAP_PORT || "993")
  const user = process.env.IMAP_USER
  const pass = process.env.IMAP_PASS
  const folder = process.env.IMAP_FOLDER || "INBOX"

  if (!host || !user || !pass) {
    console.log("IMAP not configured, skipping email poll")
    return 0
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  })

  let newCount = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      // Search for unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        uid: true,
      })

      for await (const msg of messages) {
        try {
          if (!msg.source) continue
          const parsed = await simpleParser(msg.source)
          const messageId = parsed.messageId || msg.uid.toString()

          // Deduplicate by messageId
          const existing = await prisma.source.findUnique({
            where: { messageId },
          })
          if (existing) continue

          const htmlContent = (typeof parsed.html === "string" ? parsed.html : "") || ""
          const textContent = parsed.text || ""
          const plainText = htmlContent
            ? convert(htmlContent, { wordwrap: false })
            : textContent

          await prisma.source.create({
            data: {
              type: "NEWSLETTER",
              title: parsed.subject || "Kein Betreff",
              senderEmail: parsed.from?.value?.[0]?.address || null,
              senderName: parsed.from?.value?.[0]?.name || null,
              receivedAt: parsed.date || new Date(),
              rawContent: htmlContent || textContent,
              plainText,
              messageId,
              status: "NEW",
            },
          })

          // Mark as seen
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true })
          newCount++
          console.log(`New email imported: ${parsed.subject}`)
        } catch (err) {
          console.error(`Error processing message ${msg.uid}:`, err)
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    console.error("IMAP polling error:", err)
  }

  console.log(`Email poll complete. ${newCount} new messages imported.`)
  return newCount
}
