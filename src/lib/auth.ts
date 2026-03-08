import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"

// Brute-force protection constants
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// In-memory rate limiter for login attempts per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // max 10 attempts per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Rate limit by IP
        const forwarded = req?.headers?.["x-forwarded-for"]
        const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded?.[0]) || "unknown"
        if (!checkRateLimit(ip)) {
          throw new Error("Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user) return null

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
          throw new Error(`Konto gesperrt. Versuchen Sie es in ${minutesLeft} Minuten erneut.`)
        }

        // Check if account is active
        if (!user.isActive) {
          throw new Error("Dieses Konto wurde deaktiviert.")
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (!isValid) {
          // Increment failed attempts
          const newAttempts = user.failedLoginAttempts + 1
          const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
            failedLoginAttempts: newAttempts,
          }
          if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
          }
          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })
          return null
        }

        // Reset failed attempts on successful login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        })

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || "CREATOR"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string }).role = token.role as string
      }
      return session
    },
  },
}

// Helper to check if session user is admin
export function isAdmin(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "ADMIN"
}

// Helper to require admin - returns error response or null
export function requireAdmin(session: { user?: { role?: string } } | null) {
  if (!session) {
    return { error: "Nicht autorisiert", status: 401 as const }
  }
  if (!isAdmin(session)) {
    return { error: "Keine Berechtigung", status: 403 as const }
  }
  return null
}
