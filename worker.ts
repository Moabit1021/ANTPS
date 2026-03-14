import { Worker, Queue } from "bullmq"
import { PrismaClient } from "@prisma/client"

// Use direct import paths for worker (not @/ alias)
const prisma = new PrismaClient()

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : "localhost",
  port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port || "6379") : 6379,
}

// Email polling worker
const emailWorker = new Worker(
  "email-polling",
  async () => {
    console.log("[Worker] Starting email poll...")
    try {
      const { pollEmails } = await import("./src/lib/email/imap-poller")
      const count = await pollEmails()
      console.log(`[Worker] Email poll done. ${count} new messages.`)
    } catch (err) {
      console.error("[Worker] Email poll error:", err)
    }
  },
  { connection }
)

// Source processing worker (placeholder for Phase 3)
const sourceWorker = new Worker(
  "source-processing",
  async (job) => {
    const { sourceId } = job.data
    console.log(`[Worker] Would summarize source ${sourceId} (Claude API comes in Phase 3)`)

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "READY" },
    })
  },
  { connection }
)

// Embedding generation worker
const embeddingWorker = new Worker(
  "embedding-generation",
  async (job) => {
    const { sourceId } = job.data
    console.log(`[Worker] Generating embeddings for source ${sourceId}...`)
    try {
      const { embedSource } = await import("./src/lib/embeddings")
      const chunks = await embedSource(sourceId)
      console.log(`[Worker] Embedded source ${sourceId} into ${chunks} chunks.`)
    } catch (err) {
      console.error(`[Worker] Embedding error for source ${sourceId}:`, err)
    }
  },
  { connection }
)

// Script generation worker (placeholder for Phase 3)
const scriptWorker = new Worker(
  "script-generation",
  async (job) => {
    console.log(`[Worker] Would generate script from sources: ${job.data.sourceIds}`)
  },
  { connection }
)

// Script revision worker (placeholder for Phase 3)
const revisionWorker = new Worker(
  "script-revision",
  async (job) => {
    console.log(`[Worker] Would revise script: ${job.data.scriptId}`)
  },
  { connection }
)

// Audio generation worker (placeholder for Phase 4)
const audioWorker = new Worker(
  "audio-generation",
  async (job) => {
    console.log(`[Worker] Would generate audio for script: ${job.data.scriptId}`)
  },
  { connection }
)

// Feed regeneration worker (placeholder for Phase 5)
const feedWorker = new Worker(
  "feed-regeneration",
  async () => {
    console.log("[Worker] Would regenerate podcast feed")
  },
  { connection }
)

// Automation runner worker
const automationWorker = new Worker(
  "automation-run",
  async (job) => {
    const { ruleId } = job.data
    console.log(`[Worker] Running automation rule ${ruleId}...`)

    try {
      const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
        include: { user: true },
      })

      if (!rule || !rule.isActive) {
        console.log(`[Worker] Automation ${ruleId} not found or inactive, skipping.`)
        return
      }

      // Find sources based on filter
      const sourceFilter: Record<string, unknown> = {
        userId: rule.userId,
        status: { in: ["NEW", "READY"] },
      }

      const filterConfig = rule.sourceFilter as { senders?: string[]; types?: string[] } | null
      if (filterConfig?.senders?.length) {
        sourceFilter.senderEmail = { in: filterConfig.senders }
      }
      if (filterConfig?.types?.length) {
        sourceFilter.type = { in: filterConfig.types }
      }

      // If topic filter, use semantic search
      let sourceIds: string[] = []

      if (rule.topicFilter) {
        try {
          const { searchSources } = await import("./src/lib/embeddings")
          const results = await searchSources(rule.topicFilter, rule.userId, 10)
          sourceIds = results.map(r => r.sourceId)
        } catch (err) {
          console.error(`[Worker] Topic search failed for automation ${ruleId}:`, err)
        }
      }

      if (sourceIds.length === 0) {
        // Fall back to latest sources by filter
        const sources = await prisma.source.findMany({
          where: sourceFilter,
          orderBy: { receivedAt: "desc" },
          take: 10,
          select: { id: true },
        })
        sourceIds = sources.map(s => s.id)
      }

      if (sourceIds.length === 0) {
        console.log(`[Worker] No sources found for automation ${ruleId}, skipping.`)
        await prisma.automationRule.update({
          where: { id: ruleId },
          data: { lastRunAt: new Date() },
        })
        return
      }

      // Get source data for script generation
      const sources = await prisma.source.findMany({
        where: { id: { in: sourceIds } },
      })

      // Generate script
      const { generateScript } = await import("./src/lib/llm")
      const result = await generateScript({
        sources: sources.map(s => ({ title: s.title, plainText: s.plainText })),
        speakers: rule.speakers,
        duration: rule.duration,
      })

      // Create script
      const script = await prisma.podcastScript.create({
        data: {
          title: result.suggestedTitle || `Auto-Podcast ${new Date().toLocaleDateString("de-DE")}`,
          content: result.content,
          status: "DRAFT",
          userId: rule.userId,
          modelUsed: result.model,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          config: {
            speakers: rule.speakers,
            duration: rule.duration,
            automationRuleId: ruleId,
            suggestedTitle: result.suggestedTitle,
            suggestedDescription: result.suggestedDescription,
          },
          sources: {
            create: sourceIds.map(sourceId => ({ sourceId })),
          },
        },
      })

      // Mark sources as USED
      await prisma.source.updateMany({
        where: { id: { in: sourceIds } },
        data: { status: "USED" },
      })

      console.log(`[Worker] Automation ${ruleId}: Created script ${script.id}`)

      // If auto-publish, generate audio too
      if (rule.autoPublish) {
        try {
          const { multiVoiceTextToSpeech } = await import("./src/lib/elevenlabs")
          const { writeFile, mkdir } = await import("fs/promises")
          const path = await import("path")

          const audioResult = await multiVoiceTextToSpeech(result.content)

          const audioDir = path.join(process.cwd(), "data", "audio")
          await mkdir(audioDir, { recursive: true })

          const fileName = `podcast-${script.id}-${Date.now()}.mp3`
          const filePath = path.join(audioDir, fileName)
          await writeFile(filePath, audioResult.audioBuffer)

          const wordCount = result.content.split(/\s+/).length
          const estimatedDuration = Math.round((wordCount / 150) * 60)

          const elConfig = await prisma.appSetting.findMany({
            where: { key: { in: ["elevenlabs_voice_id", "elevenlabs_voice_id_2", "elevenlabs_model"] } },
          })
          const configMap: Record<string, string> = {}
          for (const s of elConfig) configMap[s.key] = s.value

          const audio = await prisma.podcastAudio.create({
            data: {
              scriptId: script.id,
              filePath: `data/audio/${fileName}`,
              fileName,
              fileSize: audioResult.audioBuffer.length,
              duration: estimatedDuration,
              voiceAlexId: configMap.elevenlabs_voice_id || "",
              voiceKimId: configMap.elevenlabs_voice_id_2 || "",
              modelId: configMap.elevenlabs_model || "eleven_multilingual_v2",
              status: "COMPLETED",
              userId: rule.userId,
            },
          })

          await prisma.podcastScript.update({
            where: { id: script.id },
            data: { status: "COMPLETED" },
          })

          // Create and publish episode
          const lastEpisode = await prisma.podcastEpisode.findFirst({
            orderBy: { episodeNumber: "desc" },
          })
          const episodeNumber = (lastEpisode?.episodeNumber ?? 0) + 1

          await prisma.podcastEpisode.create({
            data: {
              audioId: audio.id,
              title: result.suggestedTitle || script.title,
              description: result.suggestedDescription || "",
              episodeNumber,
              status: "PUBLISHED",
              publishedAt: new Date(),
              userId: rule.userId,
            },
          })

          console.log(`[Worker] Automation ${ruleId}: Published episode ${episodeNumber}`)
        } catch (audioErr) {
          console.error(`[Worker] Automation ${ruleId}: Audio/publish failed:`, audioErr)
        }
      }

      // Update last run time
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: { lastRunAt: new Date() },
      })

      console.log(`[Worker] Automation ${ruleId} completed successfully.`)
    } catch (err) {
      console.error(`[Worker] Automation ${ruleId} failed:`, err)
    }
  },
  { connection }
)

// Set up email polling cron (every 5 minutes)
const emailQueue = new Queue("email-polling", { connection })
const automationQueue = new Queue("automation-run", { connection })

async function setupCron() {
  // Remove existing repeatable jobs first
  const repeatableJobs = await emailQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    await emailQueue.removeRepeatableByKey(job.key)
  }

  // Add new repeatable job
  await emailQueue.add("poll", {}, {
    repeat: { pattern: "*/5 * * * *" },
  })
  console.log("[Worker] Email polling cron scheduled (every 5 minutes)")
}

// Set up automation crons based on database rules
async function setupAutomationCrons() {
  // Remove existing automation repeatable jobs
  const existingJobs = await automationQueue.getRepeatableJobs()
  for (const job of existingJobs) {
    await automationQueue.removeRepeatableByKey(job.key)
  }

  // Load active automation rules
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true },
  })

  for (const rule of rules) {
    try {
      await automationQueue.add(
        `automation-${rule.id}`,
        { ruleId: rule.id },
        {
          repeat: { pattern: rule.schedule },
          jobId: `automation-${rule.id}`,
        }
      )
      console.log(`[Worker] Automation "${rule.name}" scheduled: ${rule.schedule}`)
    } catch (err) {
      console.error(`[Worker] Failed to schedule automation "${rule.name}":`, err)
    }
  }

  console.log(`[Worker] ${rules.length} automation rules scheduled.`)
}

setupCron().catch(console.error)
setupAutomationCrons().catch(console.error)

// Refresh automation crons every 5 minutes to pick up changes
setInterval(() => {
  setupAutomationCrons().catch(console.error)
}, 5 * 60 * 1000)

// Graceful shutdown
async function shutdown() {
  console.log("[Worker] Shutting down...")
  await emailWorker.close()
  await sourceWorker.close()
  await embeddingWorker.close()
  await scriptWorker.close()
  await revisionWorker.close()
  await audioWorker.close()
  await feedWorker.close()
  await automationWorker.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

console.log("[Worker] All workers started and listening for jobs")
