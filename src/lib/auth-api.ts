import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

interface AuthenticatedUser {
  id: string
  email: string
  role: string
  name: string | null
}

/**
 * Authenticate a request via NextAuth session (web) or Bearer token (mobile).
 * Returns the authenticated user or null.
 */
export async function getAuthenticatedUser(
  request?: NextRequest
): Promise<AuthenticatedUser | null> {
  // Try Bearer token first (mobile app)
  if (request) {
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      return authenticateByToken(token)
    }
  }

  // Fall back to NextAuth session (web)
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as { id?: string; email?: string; role?: string; name?: string }
  if (!user.id || !user.email) return null

  return {
    id: user.id,
    email: user.email,
    role: user.role || "CREATOR",
    name: user.name || null,
  }
}

async function authenticateByToken(token: string): Promise<AuthenticatedUser | null> {
  // Find all users with API tokens and check against the hash
  // We store bcrypt hashes, so we need to iterate (small user base)
  const usersWithTokens = await prisma.user.findMany({
    where: {
      apiTokenHash: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      apiTokenHash: true,
    },
  })

  for (const user of usersWithTokens) {
    if (user.apiTokenHash && await bcrypt.compare(token, user.apiTokenHash)) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      }
    }
  }

  return null
}

/**
 * Require authentication. Returns the user or throws an error object.
 */
export async function requireAuth(request?: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return { user: null as never, error: { error: "Nicht autorisiert", status: 401 as const } }
  }
  return { user, error: null }
}

/**
 * Require admin role. Returns the user or throws an error object.
 */
export async function requireAdminAuth(request?: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return { user: null as never, error }
  if (user.role !== "ADMIN") {
    return { user: null as never, error: { error: "Keine Berechtigung", status: 403 as const } }
  }
  return { user, error: null }
}

/**
 * Apply userId scoping for queries.
 * Admins see all data, Creators see only their own.
 */
export function userScope(user: AuthenticatedUser): { userId?: string } {
  if (user.role === "ADMIN") return {}
  return { userId: user.id }
}
