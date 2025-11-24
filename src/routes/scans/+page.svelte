<script lang="ts">
    import { onMount } from "svelte";
    import { scans, type LocalScan } from "$lib/db";
    import { syncAll, type SyncResult } from "$lib/sync";
    import { cleanupOldScans, getCleanupStats } from "$lib/cleanup";
    import { debug } from "$lib/debug";

    let scanList: LocalScan[] = $state([]);
    let filteredScanList: LocalScan[] = $state([]);
    let isLoading = $state(true);
    let isSyncing = $state(false);
    let isCleaning = $state(false);
    let selectedScan: LocalScan | null = $state(null);
    let cleanupStats = $state<any>(null);
    let editingScan: LocalScan | null = $state(null);
    let timeFilter: "all" | "hour" | "4hours" | "day" | "week" = $state("all");
    let editForm = $state({
        quantity: 0,
        stack_id: "",
        product_code: "",
        location_code: "",
        treatment: "",
        description: "",
        mr_number: "",
        supplier: "",
    });

    onMount(async () => {
        await loadScans();
        await updateCleanupStats();
    });

    $effect(() => {
        applyTimeFilter();
    });

    async function loadScans() {
        isLoading = true;
        try {
            scanList = await scans.orderBy("scanned_at").reverse().toArray();
            applyTimeFilter();
        } catch (error) {
            console.error("Error loading scans:", error);
        } finally {
            isLoading = false;
        }
    }

    function applyTimeFilter() {
        if (timeFilter === "all") {
            filteredScanList = scanList;
            return;
        }

        const now = Date.now();
        let cutoffTime = 0;

        switch (timeFilter) {
            case "hour":
                cutoffTime = now - 60 * 60 * 1000; // 1 hour
                break;
            case "4hours":
                cutoffTime = now - 4 * 60 * 60 * 1000; // 4 hours
                break;
            case "day":
                cutoffTime = now - 24 * 60 * 60 * 1000; // 1 day
                break;
        }

        filteredScanList = scanList.filter((s) => s.scanned_at >= cutoffTime);
    }

    async function deleteScan(id: string) {
        if (confirm("Are you sure you want to delete this scan?")) {
            try {
                await scans.delete(id);
                await loadScans();
                await updateCleanupStats();
            } catch (error) {
                console.error("Error deleting scan:", error);
                alert("Failed to delete scan");
            }
        }
    }

    async function updateCleanupStats() {
        cleanupStats = await getCleanupStats(7);
    }

    async function handleCleanup() {
        if (
            !confirm(
                "Delete all synced scans older than 7 days?\n\nThis will free up storage space. Unsynced scans will NOT be deleted.",
            )
        ) {
            return;
        }

        isCleaning = true;
        try {
            debug.info("Manual cleanup triggered");
            const result = await cleanupOldScans(7);
            await loadScans();
            await updateCleanupStats();
            alert(
                `Cleanup complete!\n\nDeleted: ${result?.deleted || 0} old synced scan(s)\nKept: ${result?.kept || 0} scan(s)`,
            );
        } catch (error) {
            console.error("Cleanup error:", error);
            alert("Cleanup failed");
        } finally {
            isCleaning = false;
        }
    }

    async function handleSync() {
        isSyncing = true;
        try {
            const result: SyncResult = await syncAll();
            await loadScans();
            await updateCleanupStats();

            // Show detailed feedback based on results
            if (result.networkError && result.totalScans > 0) {
                alert(
                    `❌ Sync failed: No network connection\n\n${result.totalScans} scan(s) are pending sync.\n\nPlease check your internet connection and try again.`,
                );
            } else if (result.totalScans === 0) {
                alert("✓ All scans are already synced!");
            } else if (result.successful === result.totalScans) {
                alert(
                    `✓ Sync completed successfully!\n\n${result.successful} scan(s) synced to server.`,
                );
            } else if (result.successful > 0 && result.failed > 0) {
                alert(
                    `⚠️ Sync partially completed\n\n✓ Synced: ${result.successful}\n✗ Failed: ${result.failed}\n\nCheck individual scan errors for details.`,
                );
            } else if (result.failed === result.totalScans) {
                const errorSummary =
                    result.errors.length > 0
                        ? `\n\nFirst error: ${result.errors[0].error}`
                        : "";
                alert(
                    `❌ Sync failed for all scans\n\n${result.failed} scan(s) could not be synced.${errorSummary}\n\nCheck your connection or individual scan errors.`,
                );
            }
        } catch (error) {
            console.error("Sync error:", error);
            debug.error("Unexpected sync error", error);
            alert(
                `❌ Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        } finally {
            isSyncing = false;
        }
    }
    async function retryScan(scan: LocalScan) {
        // Check network first
        if (!navigator.onLine) {
            alert(
                "❌ Cannot sync: No network connection\n\nPlease connect to the internet and try again.",
            );
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scan),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                await scans.update(scan.id, { synced: true, error: null });
                await loadScans();
                alert("✓ Scan synced successfully!");
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

                await scans.update(scan.id, { error: errorMessage });
                await loadScans();
                alert(`❌ Sync failed: ${errorMessage}`);
            }
        } catch (error) {
            console.error("Retry error:", error);
            debug.error("Retry scan failed", error);

            const isNetworkError =
                error instanceof TypeError ||
                (error instanceof Error && error.name === "AbortError");

            if (isNetworkError) {
                const errorMsg =
                    error instanceof Error && error.name === "AbortError"
                        ? "Request timeout - server not responding"
                        : "Network error - check your connection";

                await scans.update(scan.id, { error: errorMsg });
                await loadScans();
                alert(`❌ ${errorMsg}\n\nPlease try again later.`);
            } else {
                const errorMsg =
                    error instanceof Error ? error.message : "Unknown error";
                await scans.update(scan.id, { error: errorMsg });
                await loadScans();
                alert(`❌ Failed to sync: ${errorMsg}`);
            }
        }
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function viewDetails(scan: LocalScan) {
        selectedScan = scan;
    }

    function closeDetails() {
        selectedScan = null;
    }

    function startEdit(scan: LocalScan) {
        editingScan = scan;
        editForm = {
            quantity: scan.parsed?.quantity || 0,
            stack_id: scan.parsed?.stack_id || "",
            product_code: scan.parsed?.product_code || "",
            location_code: scan.parsed?.location_code || "",
            treatment: scan.parsed?.treatment || "NONE",
            description: scan.parsed?.description || "",
            mr_number: scan.parsed?.mr_number || "",
            supplier: scan.parsed?.supplier || "",
        };
    }

    function closeEdit() {
        editingScan = null;
    }

    async function saveEdit() {
        if (!editingScan) return;

        try {
            const updatedParsed = {
                ...editingScan.parsed,
                quantity: Number(editForm.quantity),
                stack_id: editForm.stack_id,
                product_code: editForm.product_code,
                location_code: editForm.location_code,
                treatment: editForm.treatment,
                description: editForm.description,
                mr_number: editForm.mr_number,
                supplier: editForm.supplier,
            };

            await scans.update(editingScan.id, {
                parsed: updatedParsed,
                synced: false,
                error: null,
            });

            await loadScans();
            closeEdit();
            alert("Scan updated successfully! You can now sync it.");
        } catch (error) {
            console.error("Error updating scan:", error);
            alert("Failed to update scan");
        }
    }

    function hasWarnings(scan: LocalScan): boolean {
        if (!scan.parsed) return true;
        return (
            !scan.parsed.quantity ||
            scan.parsed.quantity === 0 ||
            !scan.parsed.stack_id ||
            !scan.parsed.product_code
        );
    }

    function getTimeUntilDeletion(scan: LocalScan): string | null {
        if (!scan.synced) return null;

        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const scanAge = now - scan.scanned_at;
        const timeRemaining = sevenDaysMs - scanAge;

        if (timeRemaining <= 0) return "Eligible for cleanup";

        const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
        const hoursRemaining = Math.floor(
            (timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
        );

        if (daysRemaining > 0) {
            return `Auto-delete in ${daysRemaining}d ${hoursRemaining}h`;
        } else if (hoursRemaining > 0) {
            return `Auto-delete in ${hoursRemaining}h`;
        } else {
            const minutesRemaining = Math.floor(
                (timeRemaining % (60 * 60 * 1000)) / (60 * 1000),
            );
            return `Auto-delete in ${minutesRemaining}m`;
        }
    }

    function getFilterLabel(filter: string): string {
        switch (filter) {
            case "hour":
                return "Last Hour";
            case "4hours":
                return "Last 4 Hours";
            case "day":
                return "Last 24 Hours";
            default:
                return "All Time";
        }
    }

    function getFilterCount(filter: string): number {
        if (filter === "all") return scanList.length;

        const now = Date.now();
        let cutoffTime = 0;

        switch (filter) {
            case "hour":
                cutoffTime = now - 60 * 60 * 1000;
                break;
            case "4hours":
                cutoffTime = now - 4 * 60 * 60 * 1000;
                break;
            case "day":
                cutoffTime = now - 24 * 60 * 60 * 1000;
                break;
        }

        return scanList.filter((s) => s.scanned_at >= cutoffTime).length;
    }
</script>

<div class="min-h-screen bg-gray-100">
    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
        <!-- Header Actions -->
        <div class="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h1 class="text-2xl font-bold text-gray-900">Scan History</h1>
            <div class="flex gap-2">
                <button
                    onclick={handleSync}
                    disabled={isSyncing}
                    class="px-4 py-2 text-white rounded-lg hover:bg-[#6B5A42] disabled:bg-gray-400 disabled:cursor-not-allowed"
                    style="background-color: #8B7355;"
                >
                    {isSyncing ? "Syncing..." : "Sync All"}
                </button>
                <button
                    onclick={handleCleanup}
                    disabled={isCleaning}
                    class="px-4 py-2 text-white rounded-lg hover:bg-[#8B7355] disabled:bg-gray-400 disabled:cursor-not-allowed"
                    style="background-color: #A89070;"
                    title="Delete old synced scans (older than 7 days)"
                >
                    {isCleaning ? "Cleaning..." : "🧹 Cleanup"}
                </button>
            </div>
        </div>

        <!-- Time Filter Tabs -->
        <div class="mb-6 bg-white rounded-lg shadow p-2">
            <div class="flex gap-2 overflow-x-auto">
                <button
                    onclick={() => (timeFilter = "all")}
                    class="px-4 py-2 rounded whitespace-nowrap transition-colors {timeFilter ===
                    'all'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                    style={timeFilter === "all"
                        ? "background-color: #8B7355;"
                        : ""}
                >
                    All ({getFilterCount("all")})
                </button>
                <button
                    onclick={() => (timeFilter = "hour")}
                    class="px-4 py-2 rounded whitespace-nowrap transition-colors {timeFilter ===
                    'hour'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                    style={timeFilter === "hour"
                        ? "background-color: #8B7355;"
                        : ""}
                >
                    Last Hour ({getFilterCount("hour")})
                </button>
                <button
                    onclick={() => (timeFilter = "4hours")}
                    class="px-4 py-2 rounded whitespace-nowrap transition-colors {timeFilter ===
                    '4hours'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                    style={timeFilter === "4hours"
                        ? "background-color: #8B7355;"
                        : ""}
                >
                    Last 4 Hours ({getFilterCount("4hours")})
                </button>
                <button
                    onclick={() => (timeFilter = "day")}
                    class="px-4 py-2 rounded whitespace-nowrap transition-colors {timeFilter ===
                    'day'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                    style={timeFilter === "day"
                        ? "background-color: #8B7355;"
                        : ""}
                >
                    Last 24 Hours ({getFilterCount("day")})
                </button>
                <button
                    onclick={() => (timeFilter = "week")}
                    class="px-4 py-2 rounded whitespace-nowrap transition-colors {timeFilter ===
                    'week'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                    style={timeFilter === "week"
                        ? "background-color: #8B7355;"
                        : ""}
                >
                    Last 7 Days ({getFilterCount("week")})
                </button>
            </div>
        </div>

        <!-- Cleanup Stats Info -->
        {#if cleanupStats && cleanupStats.oldSynced > 0}
            <div
                class="mb-6 p-4 border-l-4 rounded"
                style="background-color: #F5F0EA; border-left-color: #8B7355;"
            >
                <div class="flex items-start gap-2">
                    <span class="text-lg" style="color: #8B7355;">ℹ️</span>
                    <div>
                        <h3 class="font-semibold mb-1" style="color: #6B5A42;">
                            Old Synced Scans Found
                        </h3>
                        <p class="text-sm" style="color: #5C4A3A;">
                            {cleanupStats.oldSynced} synced scan(s) older than 7
                            days can be cleaned up to free storage space.
                        </p>
                        <button
                            onclick={handleCleanup}
                            class="mt-2 text-sm px-3 py-1 text-white rounded hover:bg-[#8B7355]"
                            style="background-color: #A89070;"
                        >
                            Clean Up Now
                        </button>
                    </div>
                </div>
            </div>
        {/if}
        {#if isLoading}
            <div class="text-center py-12">
                <div
                    class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent"
                    style="border-color: #8B7355; border-right-color: transparent;"
                ></div>
                <p class="mt-4 text-gray-600">Loading scans...</p>
            </div>
        {:else if filteredScanList.length === 0 && scanList.length > 0}
            <div class="text-center py-12 bg-white rounded-lg shadow">
                <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">
                    No scans in {getFilterLabel(timeFilter)}
                </h3>
                <p class="mt-1 text-gray-500">
                    Try selecting a different time range or scan a new QR code.
                </p>
                <div class="mt-6">
                    <button
                        onclick={() => (timeFilter = "all")}
                        class="inline-flex items-center px-4 py-2 text-white rounded-lg hover:bg-[#6B5A42]"
                        style="background-color: #8B7355;"
                    >
                        Show All Scans
                    </button>
                </div>
            </div>
        {:else if scanList.length === 0}
            <div class="text-center py-12 bg-white rounded-lg shadow">
                <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">
                    No scans yet
                </h3>
                <p class="mt-1 text-gray-500">
                    Get started by scanning your first QR code.
                </p>
                <div class="mt-6">
                    <a
                        href="/scan"
                        class="inline-flex items-center px-4 py-2 text-white rounded-lg hover:bg-[#6B5A42]"
                        style="background-color: #8B7355;"
                    >
                        Start Scanning
                    </a>
                </div>
            </div>
        {:else}
            <div class="space-y-4">
                <!-- Stats -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="text-sm text-gray-600">
                            {timeFilter === "all"
                                ? "Total Scans"
                                : getFilterLabel(timeFilter)}
                        </div>
                        <div class="text-3xl font-bold text-gray-900">
                            {filteredScanList.length}
                        </div>
                        {#if timeFilter !== "all"}
                            <div class="text-xs text-gray-500 mt-1">
                                of {scanList.length} total
                            </div>
                        {/if}
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="text-sm text-gray-600">Synced</div>
                        <div class="text-3xl font-bold text-green-600">
                            {filteredScanList.filter((s) => s.synced).length}
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="text-sm text-gray-600">Pending</div>
                        <div class="text-3xl font-bold text-orange-600">
                            {filteredScanList.filter((s) => !s.synced).length}
                        </div>
                    </div>
                </div>

                <!-- Scan List -->
                {#each filteredScanList as scan (scan.id)}
                    <div
                        class="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
                    >
                        <!-- Header with Status -->
                        <div
                            class="px-4 py-3 border-b flex items-center justify-between {scan.synced
                                ? 'bg-green-50'
                                : scan.error
                                  ? 'bg-red-50'
                                  : 'bg-orange-50'}"
                        >
                            <div class="flex items-center gap-2">
                                {#if scan.synced}
                                    <span
                                        class="text-2xl"
                                        title="Synced to server">✅</span
                                    >
                                {:else if scan.error}
                                    <span class="text-2xl" title="Sync error"
                                        >❌</span
                                    >
                                {:else}
                                    <span class="text-2xl" title="Pending sync"
                                        >⏳</span
                                    >
                                {/if}
                                <div>
                                    <div class="font-semibold text-gray-900">
                                        {scan.synced
                                            ? "Synced"
                                            : scan.error
                                              ? "Sync Error"
                                              : "Pending Sync"}
                                    </div>
                                    <div class="text-xs text-gray-600">
                                        {formatDate(scan.scanned_at)}
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                {#if hasWarnings(scan)}
                                    <span
                                        class="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800"
                                        title="Missing critical data"
                                    >
                                        ⚠️ Warning
                                    </span>
                                {/if}
                                {#if scan.synced && getTimeUntilDeletion(scan)}
                                    <span
                                        class="px-2 py-1 text-xs font-semibold rounded"
                                        style="background-color: #F5F0EA; color: #6B5A42;"
                                        title="Auto-delete countdown"
                                    >
                                        ⏰ {getTimeUntilDeletion(scan)}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="p-4">
                            <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                                {#if scan.parsed?.mr_number}
                                    <div>
                                        <div class="text-xs text-gray-500">
                                            MR Number
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.mr_number}
                                        </div>
                                    </div>
                                {/if}
                                {#if scan.parsed?.product_code}
                                    <div>
                                        <div class="text-xs text-gray-500">
                                            Product Code
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.product_code}
                                        </div>
                                    </div>
                                {/if}
                                {#if scan.parsed?.quantity}
                                    <div>
                                        <div class="text-xs text-gray-500">
                                            Quantity
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.quantity}
                                        </div>
                                    </div>
                                {/if}
                                {#if scan.parsed?.stack_id}
                                    <div>
                                        <div class="text-xs text-gray-500">
                                            Stack ID
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.stack_id}
                                        </div>
                                    </div>
                                {/if}
                                {#if scan.parsed?.treatment}
                                    <div>
                                        <div class="text-xs text-gray-500">
                                            Treatment
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.treatment}
                                        </div>
                                    </div>
                                {/if}
                                {#if scan.parsed?.supplier}
                                    <div class="col-span-2">
                                        <div class="text-xs text-gray-500">
                                            Supplier
                                        </div>
                                        <div class="font-semibold">
                                            {scan.parsed.supplier}
                                        </div>
                                    </div>
                                {/if}
                            </div>

                            {#if scan.error}
                                <div
                                    class="mb-3 text-sm text-red-700 bg-red-50 p-3 rounded border-l-4 border-red-500"
                                >
                                    <div class="font-semibold mb-1">
                                        Sync Error:
                                    </div>
                                    {scan.error}
                                </div>
                            {/if}

                            {#if hasWarnings(scan) && !scan.error}
                                <div
                                    class="mb-3 text-sm text-yellow-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-500"
                                >
                                    <div class="font-semibold mb-1">
                                        Missing Data:
                                    </div>
                                    {[
                                        !scan.parsed?.quantity ||
                                        scan.parsed?.quantity === 0
                                            ? "quantity"
                                            : null,
                                        !scan.parsed?.stack_id
                                            ? "stack ID"
                                            : null,
                                        !scan.parsed?.product_code
                                            ? "product code"
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(", ")}
                                </div>
                            {/if}

                            <!-- Action Buttons -->
                            <div
                                class="flex flex-wrap gap-2 pt-3 border-t border-gray-200"
                            >
                                <button
                                    onclick={() => viewDetails(scan)}
                                    class="flex items-center gap-1 px-3 py-2 text-sm text-white rounded transition-colors hover:bg-[#6B5A42]"
                                    style="background-color: #8B7355;"
                                >
                                    <span>👁️</span> Details
                                </button>
                                <button
                                    onclick={() => startEdit(scan)}
                                    class="flex items-center gap-1 px-3 py-2 text-sm text-white rounded transition-colors hover:bg-[#8B7355]"
                                    style="background-color: #A89070;"
                                    title="Edit scan data"
                                >
                                    <span>✏️</span> Edit
                                </button>
                                <button
                                    onclick={() => deleteScan(scan.id)}
                                    class="flex items-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors ml-auto"
                                >
                                    <span>🗑️</span> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Details Modal -->
{#if selectedScan}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onclick={closeDetails}
        onkeydown={(e) => e.key === "Escape" && closeDetails()}
        role="dialog"
        aria-modal="true"
    >
        <div
            class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
            role="document"
        >
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-bold">Scan Details</h2>
                    <button
                        onclick={closeDetails}
                        class="text-gray-500 hover:text-gray-700"
                        aria-label="Close dialog"
                    >
                        <svg
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div class="space-y-4">
                    <div>
                        <h3 class="font-semibold text-gray-700 mb-1">
                            Scanned At
                        </h3>
                        <p class="text-gray-900">
                            {formatDate(selectedScan.scanned_at)}
                        </p>
                    </div>

                    <div>
                        <h3 class="font-semibold text-gray-700 mb-1">Status</h3>
                        <span
                            class="inline-block px-3 py-1 text-sm font-semibold rounded {selectedScan.synced
                                ? 'bg-green-100 text-green-800'
                                : selectedScan.error
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-orange-100 text-orange-800'}"
                        >
                            {selectedScan.synced
                                ? "Synced"
                                : selectedScan.error
                                  ? "Error"
                                  : "Pending Sync"}
                        </span>
                    </div>

                    {#if selectedScan.error}
                        <div>
                            <h3 class="font-semibold text-red-700 mb-1">
                                Error
                            </h3>
                            <p class="text-red-600 bg-red-50 p-3 rounded">
                                {selectedScan.error}
                            </p>
                        </div>
                    {/if}

                    <div>
                        <h3 class="font-semibold text-gray-700 mb-1">
                            Raw QR Data
                        </h3>
                        <pre
                            class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">{selectedScan.raw_scan_data}</pre>
                    </div>

                    <div>
                        <h3 class="font-semibold text-gray-700 mb-1">
                            Parsed Data
                        </h3>
                        <pre
                            class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">{JSON.stringify(
                                selectedScan.parsed,
                                null,
                                2,
                            )}</pre>
                    </div>
                </div>

                <div class="mt-6 flex justify-end">
                    <button
                        onclick={closeDetails}
                        class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Edit Modal -->
{#if editingScan}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onclick={closeEdit}
        onkeydown={(e) => e.key === "Escape" && closeEdit()}
        role="dialog"
        aria-modal="true"
    >
        <div
            class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
            role="document"
        >
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-bold">Edit Scan Data</h2>
                    <button
                        onclick={closeEdit}
                        class="text-gray-500 hover:text-gray-700"
                        aria-label="Close dialog"
                    >
                        <svg
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <form
                    onsubmit={(e) => {
                        e.preventDefault();
                        saveEdit();
                    }}
                    class="space-y-4"
                >
                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Quantity <span class="text-red-600">*</span>
                        </label>
                        <input
                            type="number"
                            bind:value={editForm.quantity}
                            required
                            min="0"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Stack ID <span class="text-red-600">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={editForm.stack_id}
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Product Code <span class="text-red-600">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={editForm.product_code}
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Location Code
                        </label>
                        <input
                            type="text"
                            bind:value={editForm.location_code}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Treatment
                        </label>
                        <select
                            bind:value={editForm.treatment}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="NONE">None</option>
                            <option value="PYRO-GUARD">Pyro-Guard</option>
                            <option value="MCA-C .06 AG">MCA-C .06 AG</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            MR Number
                        </label>
                        <input
                            type="text"
                            bind:value={editForm.mr_number}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Supplier
                        </label>
                        <input
                            type="text"
                            bind:value={editForm.supplier}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-semibold text-gray-700 mb-1"
                        >
                            Description
                        </label>
                        <textarea
                            bind:value={editForm.description}
                            rows="3"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        ></textarea>
                    </div>

                    <div class="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onclick={closeEdit}
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-4 py-2 text-white rounded hover:bg-[#6B5A42]"
                            style="background-color: #8B7355;"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}
