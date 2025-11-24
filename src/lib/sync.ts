import { browser } from "$app/environment";
import { scans } from "./db";
import { debug } from "./debug";
import { cleanupOldScans } from "./cleanup";

// Run cleanup on module initialization (when app loads)
if (browser) {
  cleanupOldScans(7).then(() => {
    debug.log("Initial cleanup check completed");
  });
}

export interface SyncResult {
  totalScans: number;
  successful: number;
  failed: number;
  networkError: boolean;
  errors: Array<{ scanId: string; error: string }>;
}

export async function syncAll(): Promise<SyncResult> {
  if (!browser) {
    return {
      totalScans: 0,
      successful: 0,
      failed: 0,
      networkError: false,
      errors: [],
    };
  }

  // Check if we're online first
  if (!navigator.onLine) {
    debug.warn("Device is offline, skipping sync");
    return {
      totalScans: 0,
      successful: 0,
      failed: 0,
      networkError: true,
      errors: [{ scanId: "all", error: "Device is offline" }],
    };
  }

  const unsynced = await scans.filter((s: any) => !s.synced).toArray();
  debug.info(`Starting sync for ${unsynced.length} scan(s)`);

  const result: SyncResult = {
    totalScans: unsynced.length,
    successful: 0,
    failed: 0,
    networkError: false,
    errors: [],
  };

  for (const s of unsynced) {
    try {
      debug.log(`Syncing scan ${s.id}`, { raw: s.raw_scan_data });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        await scans.update(s.id, { synced: true, error: null });
        result.successful++;
        debug.log(`✓ Scan ${s.id} synced successfully`);
      } else {
        const text = await res.text();
        let errorMessage = text;

        // Try to parse error message if it's JSON
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error || errorJson.message || text;
        } catch {
          // Not JSON, use raw text
        }

        await scans.update(s.id, { error: errorMessage });
        result.failed++;
        result.errors.push({ scanId: s.id, error: errorMessage });
        debug.error(`✗ Sync failed for ${s.id}`, { error: errorMessage });
      }
    } catch (e) {
      // Network error, timeout, or other fetch failure
      const isNetworkError =
        e instanceof TypeError ||
        (e instanceof Error && e.name === "AbortError");

      if (isNetworkError) {
        result.networkError = true;
        const errorMsg =
          e instanceof Error && e.name === "AbortError"
            ? "Request timeout - server not responding"
            : "Network error - check your connection";

        // Mark scan with network error
        await scans.update(s.id, {
          error: errorMsg,
        });
        result.failed++;
        result.errors.push({ scanId: s.id, error: errorMsg });
        debug.warn(`Network error syncing ${s.id}`, e);
      } else {
        // Unknown error
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        await scans.update(s.id, { error: errorMsg });
        result.failed++;
        result.errors.push({ scanId: s.id, error: errorMsg });
        debug.error(`Unexpected error syncing ${s.id}`, e);
      }
    }
  }

  debug.info(
    `Sync complete: ${result.successful} successful, ${result.failed} failed`,
  );

  // Only cleanup if at least some syncs succeeded
  if (result.successful > 0) {
    await cleanupOldScans(7);
  }

  return result;
}

if (browser) {
  window.addEventListener("online", () => {
    debug.info("Device came online, triggering sync...");
    syncAll().then((result) => {
      if (result.successful > 0) {
        debug.info(`Auto-sync successful: ${result.successful} scans synced`);
      } else if (result.failed > 0) {
        debug.warn(`Auto-sync completed with ${result.failed} failures`);
      }
    });
  });
}
