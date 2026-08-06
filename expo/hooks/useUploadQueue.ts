import { useSyncExternalStore } from "react";
import { subscribeUploadQueue, uploadQueueSnapshot, type UploadJob } from "@/lib/uploadQueue";

/** Every file still waiting to be sent, all episodes together. */
export function usePendingUploads(): UploadJob[] {
  return useSyncExternalStore(subscribeUploadQueue, uploadQueueSnapshot, uploadQueueSnapshot);
}

/**
 * How many files are still on their way to one episode.
 *
 * The gallery needs it: photos now appear a moment after the screen said
 * "envoyées", and a gallery that stays empty in the meantime looks like it lost
 * them.
 */
export function usePendingUploadCount(episodeId: string): number {
  const jobs = usePendingUploads();
  return jobs.reduce((n, job) => (job.episodeId === episodeId ? n + 1 : n), 0);
}
