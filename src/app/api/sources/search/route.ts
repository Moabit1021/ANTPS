import { NextRequest, NextResponse } from "next/server"
import { requireAuth, userScope } from "@/lib/auth-api"
import { searchSources } from "@/lib/embeddings"

export const dynamic = "force-dynamic"

/**
 * GET /api/sources/search?q=KI im Gesundheitswesen&limit=20
 * Semantic search across all sources using vector similarity.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status })
  }

  const q = request.nextUrl.searchParams.get("q")
  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Suchbegriff (q) muss mindestens 2 Zeichen lang sein" },
      { status: 400 }
    )
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20"), 50)

  try {
    const scope = userScope(user)
    const results = await searchSources(q.trim(), scope.userId, limit)

    return NextResponse.json({
      query: q,
      results,
      count: results.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suchfehler"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
