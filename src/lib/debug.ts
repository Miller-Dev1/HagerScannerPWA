import { writable } from "svelte/store";
import { browser } from "$app/environment";

export interface DebugLog {
  id: number;
  timestamp: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
  data?: any;
}

function createDebugStore() {
  const { subscribe, set, update } = writable<{
    enabled: boolean;
    logs: DebugLog[];
  }>({
    enabled: false,
    logs: [],
  });

  let logIdCounter = 0;

  return {
    subscribe,
    toggle: () => {
      update((state) => ({ ...state, enabled: !state.enabled }));
    },
    enable: () => {
      update((state) => ({ ...state, enabled: true }));
    },
    disable: () => {
      update((state) => ({ ...state, enabled: false }));
    },
    clear: () => {
      update((state) => ({ ...state, logs: [] }));
      logIdCounter = 0;
    },
    log: (message: string, data?: any) => {
      const log: DebugLog = {
        id: logIdCounter++,
        timestamp: Date.now(),
        level: "log",
        message,
        data,
      };
      update((state) => ({
        ...state,
        logs: [...state.logs, log],
      }));
      if (browser) {
        console.log(`[DEBUG] ${message}`, data || "");
      }
    },
    info: (message: string, data?: any) => {
      const log: DebugLog = {
        id: logIdCounter++,
        timestamp: Date.now(),
        level: "info",
        message,
        data,
      };
      update((state) => ({
        ...state,
        logs: [...state.logs, log],
      }));
      if (browser) {
        console.info(`[DEBUG] ${message}`, data || "");
      }
    },
    warn: (message: string, data?: any) => {
      const log: DebugLog = {
        id: logIdCounter++,
        timestamp: Date.now(),
        level: "warn",
        message,
        data,
      };
      update((state) => ({
        ...state,
        logs: [...state.logs, log],
      }));
      if (browser) {
        console.warn(`[DEBUG] ${message}`, data || "");
      }
    },
    error: (message: string, data?: any) => {
      const log: DebugLog = {
        id: logIdCounter++,
        timestamp: Date.now(),
        level: "error",
        message,
        data,
      };
      update((state) => ({
        ...state,
        logs: [...state.logs, log],
      }));
      if (browser) {
        console.error(`[DEBUG] ${message}`, data || "");
      }
    },
  };
}

export const debugStore = createDebugStore();

// Global debug function
export const debug = {
  log: (message: string, data?: any) => debugStore.log(message, data),
  info: (message: string, data?: any) => debugStore.info(message, data),
  warn: (message: string, data?: any) => debugStore.warn(message, data),
  error: (message: string, data?: any) => debugStore.error(message, data),
};

// Expose debug globally for browser console access
if (browser && typeof window !== "undefined") {
  (window as any).debug = debug;
  console.log(
    "%c[Debug Console] Available! Use window.debug.log(), .info(), .warn(), .error()",
    "color: #10b981; font-weight: bold;",
  );
}
