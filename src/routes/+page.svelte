<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { scans, db } from "$lib/db";
    import { debugStore, debug } from "$lib/debug";

    let totalScans = $state(0);
    let pendingScans = $state(0);

    onMount(async () => {
        if (browser) {
            const allScans = await scans.toArray();
            totalScans = allScans.length;
            pendingScans = allScans.filter((s: any) => !s.synced).length;
        }
    });
</script>

<div
    class="min-h-screen"
    style="background: linear-gradient(to bottom right, #8B7355, #6B5A42);"
>
    <div class="container mx-auto px-4 py-12">
        <div class="text-center mb-12">
            <h1 class="text-5xl font-bold text-white mb-4">Lumber Scanner</h1>
            <p class="text-xl text-amber-100">
                Scan, Track, and Manage QR Codes
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <!-- Scan Card -->
            <a
                href="/scan"
                class="block bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
                <div class="flex flex-col items-center text-center">
                    <div
                        class="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                        style="background-color: #6B8E23;"
                    >
                        <svg
                            class="w-10 h-10 text-white"
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
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        Scan QR Code
                    </h2>
                    <p class="text-gray-600">
                        Use your camera to scan lumber QR codes
                    </p>
                </div>
            </a>

            <!-- View Scans Card -->
            <a
                href="/scans"
                class="block bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
                <div class="flex flex-col items-center text-center">
                    <div
                        class="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                        style="background-color: #8B7355;"
                    >
                        <svg
                            class="w-10 h-10 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                        </svg>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        View Scans
                    </h2>
                    <p class="text-gray-600">
                        Review and manage your scan history
                    </p>
                    {#if totalScans > 0}
                        <div class="mt-4 flex gap-4 text-sm">
                            <span class="text-gray-700">
                                <strong>{totalScans}</strong> total
                            </span>
                            {#if pendingScans > 0}
                                <span class="text-orange-600">
                                    <strong>{pendingScans}</strong> pending
                                </span>
                            {/if}
                        </div>
                    {/if}
                </div>
            </a>
        </div>

        <!-- Debug Console Toggle -->
        <div class="mt-8 text-center space-y-3">
            <label
                class="inline-flex items-center gap-2 backdrop-blur-sm rounded-lg px-4 py-2 cursor-pointer transition-colors hover:bg-white/20"
                style="background-color: rgba(255, 255, 255, 0.1);"
            >
                <input
                    type="checkbox"
                    checked={$debugStore.enabled}
                    onchange={() => debugStore.toggle()}
                    class="w-4 h-4"
                />
                <span class="text-white text-sm font-medium">
                    Enable Debug Console
                </span>
            </label>
        </div>
    </div>
</div>
