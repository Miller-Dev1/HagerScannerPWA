import { browser } from "$app/environment";
import { scans } from "./db";
import { debug } from "./debug";

/**
 * Cleanup old synced scans from local storage
 * Only removes scans that are:
 * 1. Successfully synced (synced: true)
 * 2. Older than the specified retention period
 *
 * Unsynced scans are NEVER deleted regardless of age
 */
export async function cleanupOldScans(retentionDays: number = 7) {
  if (!browser) return;

  try {
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000; // days to milliseconds
    const cutoffTime = now - retentionMs;

    debug.info(
      `Starting cleanup of synced scans older than ${retentionDays} day(s)`,
    );

    // Get all synced scans
    const allScans = await scans.toArray();
    const syncedScans = allScans.filter((s: any) => s.synced === true);
    const oldSyncedScans = syncedScans.filter(
      (s: any) => s.scanned_at < cutoffTime,
    );

    if (oldSyncedScans.length === 0) {
      debug.log("No old synced scans to cleanup");
      return { deleted: 0, kept: allScans.length };
    }

    debug.log(`Found ${oldSyncedScans.length} synced scan(s) to delete`, {
      total: allScans.length,
      synced: syncedScans.length,
      oldSynced: oldSyncedScans.length,
    });

    // Delete old synced scans
    const idsToDelete = oldSyncedScans.map((s: any) => s.id);
    await scans.bulkDelete(idsToDelete);

    debug.info(
      `✓ Cleanup complete: deleted ${idsToDelete.length} old synced scan(s)`,
    );

    return {
      deleted: idsToDelete.length,
      kept: allScans.length - idsToDelete.length,
    };
  } catch (error) {
    debug.error("Cleanup failed", error);
    console.error("Error cleaning up old scans:", error);
    return { deleted: 0, kept: 0, error };
  }
}

/**
 * Get cleanup statistics without actually deleting
 */
export async function getCleanupStats(retentionDays: number = 7) {
  if (!browser) return null;

  try {
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    const allScans = await scans.toArray();
    const syncedScans = allScans.filter((s: any) => s.synced === true);
    const unsyncedScans = allScans.filter((s: any) => s.synced === false);
    const oldSyncedScans = syncedScans.filter(
      (s: any) => s.scanned_at < cutoffTime,
    );

    return {
      total: allScans.length,
      synced: syncedScans.length,
      unsynced: unsyncedScans.length,
      oldSynced: oldSyncedScans.length,
      cutoffDate: new Date(cutoffTime).toLocaleString(),
    };
  } catch (error) {
    console.error("Error getting cleanup stats:", error);
    return null;
  }
}
