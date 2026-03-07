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
    // Dynamic import to handle the alias issue in worker context
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

// Set up email polling cron (every 5 minutes)
const emailQueue = new Queue("email-polling", { connection })

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

setupCron().catch(console.error)

// Graceful shutdown
async function shutdown() {
  console.log("[Worker] Shutting down...")
  await emailWorker.close()
  await sourceWorker.close()
  await scriptWorker.close()
  await revisionWorker.close()
  await audioWorker.close()
  await feedWorker.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

console.log("[Worker] All workers started and listening for jobs")
