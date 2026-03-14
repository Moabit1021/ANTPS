import { prisma } from "@/lib/prisma"

const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536
const MAX_CHUNK_LENGTH = 8000 // characters per chunk

interface EmbeddingResult {
  embedding: number[]
  model: string
  tokensUsed: number
}

async function getOpenAIKey(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "openai_api_key" },
  })
  if (!setting?.value) {
    throw new Error("OpenAI API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.")
  }
  return setting.value
}

/**
 * Generate an embedding for a single text using OpenAI API.
 */
async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = await getOpenAIKey()

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI Embedding API Fehler: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return {
    embedding: data.data[0].embedding,
    model: data.model,
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

/**
 * Split text into chunks for embedding.
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [text]

  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ""

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_CHUNK_LENGTH) {
      if (current) chunks.push(current.trim())
      current = para
    } else {
      current += (current ? "\n\n" : "") + para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}

/**
 * Generate and store embeddings for a source.
 */
/**
 * Check if pgvector is available in the database.
 */
async function isPgvectorAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`)
    return true
  } catch {
    return false
  }
}

export async function embedSource(sourceId: string): Promise<number> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { id: true, plainText: true, title: true },
  })

  if (!source) throw new Error(`Source ${sourceId} nicht gefunden`)

  // Check if pgvector is available
  if (!(await isPgvectorAvailable())) {
    console.warn("[Embeddings] pgvector not available, skipping embedding generation")
    return 0
  }

  // Delete existing embeddings
  await prisma.sourceEmbedding.deleteMany({ where: { sourceId } })

  const textToEmbed = `${source.title}\n\n${source.plainText}`
  const chunks = chunkText(textToEmbed)

  for (let i = 0; i < chunks.length; i++) {
    const result = await generateEmbedding(chunks[i])

    // Create the embedding record in Prisma
    const record = await prisma.sourceEmbedding.create({
      data: {
        sourceId,
        chunk: chunks[i],
        chunkIndex: i,
        model: result.model,
      },
    })

    // Store the vector using raw SQL (pgvector)
    const vectorStr = `[${result.embedding.join(",")}]`
    await prisma.$executeRawUnsafe(
      `UPDATE "SourceEmbedding" SET "embedding" = $1::vector WHERE "id" = $2`,
      vectorStr,
      record.id
    )
  }

  return chunks.length
}

/**
 * Search sources by semantic similarity.
 * Returns source IDs ranked by relevance.
 */
export async function searchSources(
  query: string,
  userId?: string,
  limit: number = 20,
  similarityThreshold: number = 0.3
): Promise<Array<{
  sourceId: string
  title: string
  senderName: string | null
  receivedAt: Date
  similarity: number
  matchedChunk: string
}>> {
  // Check if pgvector is available
  if (!(await isPgvectorAvailable())) {
    throw new Error("Semantische Suche nicht verfuegbar. pgvector Extension muss in PostgreSQL installiert werden.")
  }

  const result = await generateEmbedding(query)
  const vectorStr = `[${result.embedding.join(",")}]`

  // Use raw SQL for vector similarity search
  const userFilter = userId
    ? `AND s."userId" = '${userId}'`
    : ""

  const results = await prisma.$queryRawUnsafe<Array<{
    sourceId: string
    title: string
    senderName: string | null
    receivedAt: Date
    similarity: number
    chunk: string
  }>>(
    `SELECT
      se."sourceId",
      s."title",
      s."senderName",
      s."receivedAt",
      1 - (se."embedding" <=> $1::vector) as similarity,
      se."chunk"
    FROM "SourceEmbedding" se
    JOIN "Source" s ON s."id" = se."sourceId"
    WHERE se."embedding" IS NOT NULL
      ${userFilter}
      AND 1 - (se."embedding" <=> $1::vector) > $2
    ORDER BY se."embedding" <=> $1::vector
    LIMIT $3`,
    vectorStr,
    similarityThreshold,
    limit
  )

  // Deduplicate by sourceId (keep highest similarity)
  const seen = new Map<string, typeof results[0]>()
  for (const r of results) {
    const existing = seen.get(r.sourceId)
    if (!existing || r.similarity > existing.similarity) {
      seen.set(r.sourceId, r)
    }
  }

  return Array.from(seen.values()).map(r => ({
    sourceId: r.sourceId,
    title: r.title,
    senderName: r.senderName,
    receivedAt: r.receivedAt,
    similarity: r.similarity,
    matchedChunk: r.chunk.slice(0, 200),
  }))
}
