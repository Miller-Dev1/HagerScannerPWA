<script lang="ts">
    import favicon from "$lib/assets/favicon.svg";
    import hagerLogo from "$lib/assets/Hager_nobg.png";
    import "../app.css";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import DebugConsole from "$lib/components/DebugConsole.svelte";
    import NetworkStatus from "$lib/components/NetworkStatus.svelte";
    import { debug } from "$lib/debug";
    let { children } = $props();

    function isActive(path: string): boolean {
        if (!browser) return false;
        return $page.url.pathname === path;
    }

    if (browser && "serviceWorker" in navigator) {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then(() => debug.log("SW registered"))
            .catch((err) => debug.error("SW registration failed", err));
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon} />

    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    <!-- PWA icons -->
    <link rel="icon" href="/icons/icon-192.png" sizes="192x192" />
    <link rel="icon" href="/icons/icon-512.png" sizes="512x512" />

    <!-- iOS home screen icons -->
    <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/icons/apple-touch-icon-180.png"
    />
    <link
        rel="apple-touch-icon"
        sizes="167x167"
        href="/icons/apple-touch-icon-167.png"
    />
    <link
        rel="apple-touch-icon"
        sizes="152x152"
        href="/icons/apple-touch-icon-152.png"
    />

    <!-- iOS PWA fullscreen support -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
</svelte:head>

<div class="min-h-screen flex flex-col">
    <!-- Network Status Banner -->
    <NetworkStatus />

    <!-- Navigation Bar -->
    <nav class="bg-white shadow-md">
        <div class="container mx-auto px-4">
            <div class="flex items-center justify-between h-16">
                <a href="/" class="flex items-center">
                    <img src={hagerLogo} alt="Hager Logo" class="h-12 w-auto" />
                </a>
                <div class="flex gap-2">
                    <a
                        href="/"
                        class="px-4 py-2 rounded-lg transition-colors {isActive(
                            '/',
                        )
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-100'}"
                        style={isActive("/")
                            ? "background-color: #8B7355;"
                            : ""}
                    >
                        Home
                    </a>
                    <a
                        href="/scan"
                        class="px-4 py-2 rounded-lg transition-colors {isActive(
                            '/scan',
                        )
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-100'}"
                        style={isActive("/scan")
                            ? "background-color: #8B7355;"
                            : ""}
                    >
                        Scan
                    </a>
                    <a
                        href="/scans"
                        class="px-4 py-2 rounded-lg transition-colors {isActive(
                            '/scans',
                        )
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-100'}"
                        style={isActive("/scans")
                            ? "background-color: #8B7355;"
                            : ""}
                    >
                        History
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Page Content -->
    <main class="flex-1">
        {@render children()}
    </main>

    <!-- Debug Console -->
    <DebugConsole />
</div>
