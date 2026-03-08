import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

// SMTP settings keys stored in AppSetting
const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from_email",
  "smtp_from_name",
  "smtp_secure",
] as const

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  fromEmail: string
  fromName: string
  secure: boolean
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [...SMTP_KEYS] } },
  })

  const map: Record<string, string> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  if (!map.smtp_host || !map.smtp_user || !map.smtp_pass) {
    return null
  }

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || "465"),
    user: map.smtp_user,
    pass: map.smtp_pass,
    fromEmail: map.smtp_from_email || map.smtp_user,
    fromName: map.smtp_from_name || "PodBrief",
    secure: map.smtp_secure !== "false",
  }
}

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}

export async function sendInviteEmail(
  toEmail: string,
  inviteToken: string,
  baseUrl: string,
  expiresAt: Date
): Promise<void> {
  const config = await getSmtpConfig()
  if (!config) {
    throw new Error("SMTP ist nicht konfiguriert. Bitte richten Sie die E-Mail-Einstellungen ein.")
  }

  const registerUrl = `${baseUrl}/register?token=${inviteToken}`
  const expiresFormatted = expiresAt.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const transport = createTransport(config)

  await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: toEmail,
    subject: "Einladung zu PodBrief",
    text: `Sie wurden zu PodBrief eingeladen.

Erstellen Sie Ihr Konto unter folgendem Link:
${registerUrl}

Der Link ist gueltig bis: ${expiresFormatted}

Falls Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; font-size: 24px;">PodBrief</h1>
  </div>
  <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Sie wurden eingeladen</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Sie wurden eingeladen, ein Konto bei PodBrief zu erstellen.
      Klicken Sie auf den Button, um Ihr Konto einzurichten.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${registerUrl}" style="background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; display: inline-block;">
        Konto erstellen
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      Dieser Link ist gueltig bis: ${expiresFormatted}
    </p>
  </div>
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">
    Falls Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.
  </p>
</body>
</html>`,
  })
}

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const config = await getSmtpConfig()
  if (!config) {
    return { success: false, error: "SMTP ist nicht konfiguriert." }
  }

  try {
    const transport = createTransport(config)
    await transport.verify()
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen",
    }
  }
}
