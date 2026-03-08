-- Migration: Add ON DELETE CASCADE to PodcastEpisode -> PodcastAudio relation
-- This is safe because episodes should always be deleted when their audio is deleted

-- Drop the existing foreign key constraint
ALTER TABLE "PodcastEpisode" DROP CONSTRAINT IF EXISTS "PodcastEpisode_audioId_fkey";

-- Re-add with ON DELETE CASCADE
ALTER TABLE "PodcastEpisode"
  ADD CONSTRAINT "PodcastEpisode_audioId_fkey"
  FOREIGN KEY ("audioId") REFERENCES "PodcastAudio"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
