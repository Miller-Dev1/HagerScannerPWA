<script lang="ts">
    import { debugStore } from "$lib/debug";
    import { onMount } from "svelte";

    let isExpanded = $state(false);
    let autoScroll = $state(true);
    let consoleContainer: HTMLDivElement;

    $effect(() => {
        if (autoScroll && consoleContainer) {
            consoleContainer.scrollTop = consoleContainer.scrollHeight;
        }
    });

    function formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function getLevelColor(level: string): string {
        switch (level) {
            case "error":
                return "text-red-600 bg-red-50";
            case "warn":
                return "text-yellow-600 bg-yellow-50";
            case "info":
                return "text-blue-600 bg-blue-50";
            default:
                return "text-gray-600 bg-gray-50";
        }
    }

    function getLevelIcon(level: string): string {
        switch (level) {
            case "error":
                return "❌";
            case "warn":
                return "⚠️";
            case "info":
                return "ℹ️";
            default:
                return "📝";
        }
    }

    function copyToClipboard() {
        const logs = $debugStore.logs
            .map(
                (log) =>
                    `[${formatTime(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}${log.data ? "\n" + JSON.stringify(log.data, null, 2) : ""}`,
            )
            .join("\n");

        navigator.clipboard.writeText(logs).then(() => {
            alert("Logs copied to clipboard!");
        });
    }
</script>

{#if $debugStore.enabled}
    <div
        class="fixed bottom-0 left-0 right-0 z-50 bg-black text-green-400 font-mono text-xs shadow-2xl border-t-2 border-green-500"
    >
        <!-- Header -->
        <div class="bg-gray-900 px-4 py-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <button
                    onclick={() => (isExpanded = !isExpanded)}
                    class="text-green-400 hover:text-green-300"
                >
                    {isExpanded ? "▼" : "▲"}
                </button>
                <span class="font-bold">Debug Console</span>
                <span class="text-gray-500">
                    ({$debugStore.logs.length} logs)
                </span>
            </div>
            <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-xs">
                    <input
                        type="checkbox"
                        bind:checked={autoScroll}
                        class="w-3 h-3"
                    />
                    Auto-scroll
                </label>
                <button
                    onclick={copyToClipboard}
                    class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                    title="Copy logs"
                >
                    📋 Copy
                </button>
                <button
                    onclick={() => debugStore.clear()}
                    class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                    title="Clear logs"
                >
                    🗑️ Clear
                </button>
                <button
                    onclick={() => debugStore.disable()}
                    class="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                    title="Close console"
                >
                    ✕
                </button>
            </div>
        </div>

        <!-- Logs Container -->
        {#if isExpanded}
            <div
                bind:this={consoleContainer}
                class="overflow-y-auto px-4 py-2 space-y-1"
                style="max-height: 400px;"
            >
                {#if $debugStore.logs.length === 0}
                    <div class="text-gray-500 italic py-4 text-center">
                        No logs yet. Use debug.log(), debug.info(),
                        debug.warn(), or debug.error() to log messages.
                    </div>
                {:else}
                    {#each $debugStore.logs as log (log.id)}
                        <div class="py-1 border-b border-gray-800">
                            <div class="flex items-start gap-2">
                                <span class="text-gray-500 shrink-0">
                                    {formatTime(log.timestamp)}
                                </span>
                                <span class="shrink-0">
                                    {getLevelIcon(log.level)}
                                </span>
                                <span
                                    class="font-semibold uppercase text-xs px-1 rounded {getLevelColor(
                                        log.level,
                                    )}"
                                >
                                    {log.level}
                                </span>
                                <span class="flex-1 break-all">
                                    {log.message}
                                </span>
                            </div>
                            {#if log.data}
                                <pre
                                    class="mt-1 ml-24 text-yellow-300 bg-gray-800 p-2 rounded overflow-x-auto">{JSON.stringify(
                                        log.data,
                                        null,
                                        2,
                                    )}</pre>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
{/if}
