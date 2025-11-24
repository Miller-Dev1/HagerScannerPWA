import Dexie from "dexie";
import { browser } from "$app/environment";

export interface LocalScan {
  id: string;
  raw_scan_data: string;
  parsed: any | null;
  scanned_at: number;
  synced: boolean;
  error?: string | null;
}

export const db = browser ? new Dexie("lumberScanDB") : ({} as Dexie);

if (browser) {
  db.version(1).stores({
    scans: "id, scanned_at, synced",
  });
}

export const scans = browser
  ? db.table<LocalScan, string>("scans")
  : ({} as any);
