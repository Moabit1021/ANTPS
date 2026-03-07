import { Queue } from "bullmq"

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : "localhost",
  port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port || "6379") : 6379,
}

export const emailPollingQueue = new Queue("email-polling", { connection })
export const sourceProcessingQueue = new Queue("source-processing", { connection })
export const scriptGenerationQueue = new Queue("script-generation", { connection })
export const scriptRevisionQueue = new Queue("script-revision", { connection })
export const audioGenerationQueue = new Queue("audio-generation", { connection })
export const feedRegenerationQueue = new Queue("feed-regeneration", { connection })
