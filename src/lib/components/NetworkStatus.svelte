<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    let isOnline = $state(true);
    let showOfflineBanner = $state(false);

    function updateOnlineStatus() {
        if (browser) {
            const wasOnline = isOnline;
            isOnline = navigator.onLine;

            // Show banner when going offline
            if (wasOnline && !isOnline) {
                showOfflineBanner = true;
            }

            // Auto-hide banner when back online after 3 seconds
            if (!wasOnline && isOnline) {
                showOfflineBanner = true;
                setTimeout(() => {
                    showOfflineBanner = false;
                }, 3000);
            }
        }
    }

    onMount(() => {
        if (browser) {
            isOnline = navigator.onLine;
            window.addEventListener("online", updateOnlineStatus);
            window.addEventListener("offline", updateOnlineStatus);
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
        }
    });
</script>

{#if showOfflineBanner}
    <div
        class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style="animation: slideDown 0.3s ease-out;"
    >
        {#if !isOnline}
            <div class="bg-red-600 text-white px-4 py-3 shadow-lg">
                <div class="flex items-center justify-center gap-2">
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                        />
                    </svg>
                    <span class="font-semibold">No Internet Connection</span>
                </div>
                <p class="text-center text-sm mt-1 opacity-90">
                    Scans will be saved locally and synced when connection is restored
                </p>
            </div>
        {:else}
            <div class="bg-green-600 text-white px-4 py-3 shadow-lg">
                <div class="flex items-center justify-center gap-2">
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                        />
                    </svg>
                    <span class="font-semibold">Back Online</span>
                </div>
                <p class="text-center text-sm mt-1 opacity-90">
                    Connection restored - pending scans will sync automatically
                </p>
            </div>
        {/if}
    </div>
{/if}

<style>
    @keyframes slideDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>
