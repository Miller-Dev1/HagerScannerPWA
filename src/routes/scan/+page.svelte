<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { BrowserQRCodeReader } from "@zxing/browser";
    import { scans } from "$lib/db";
    import { parseQR } from "$lib/qrParser";
    import { debug } from "$lib/debug";

    let videoEl: HTMLVideoElement;
    let codeReader: BrowserQRCodeReader | null = null;
    let isScanning = false;
    let isPaused = false;
    let lastScannedCode = "";
    let scanFeedback = "";
    let errorMessage = "";
    let isProcessing = false;
    let selectedCameraId = "";

    async function waitForPWAToBeReady() {
        // Make sure full page load completed (critical in iOS PWAs)
        if (document.readyState !== "complete") {
            await new Promise((resolve) =>
                window.addEventListener("load", resolve, { once: true }),
            );
        }

        // Ensure service worker is controlling the page
        if ("serviceWorker" in navigator) {
            if (!navigator.serviceWorker.controller) {
                await new Promise((resolve) =>
                    navigator.serviceWorker.addEventListener(
                        "controllerchange",
                        () => resolve(true),
                    ),
                );
            }
        }

        // iOS-specific delay (very important)
        await new Promise((r) => setTimeout(r, 300));
    }

    onMount(async () => {
        try {
            debug.info("Waiting for PWA Hydration...");
            // important to uncomment this when deploying as PWA
            // await waitForPWAToBeReady();
            debug.info("PWA Hydration complete. Initializing camera...");
            codeReader = new BrowserQRCodeReader();
            const devices = await BrowserQRCodeReader.listVideoInputDevices();

            debug.log(
                `Found ${devices.length} camera device(s)`,
                devices.map((d) => d.label),
            );

            if (devices.length === 0) {
                errorMessage = "No camera devices found";
                debug.error("No camera devices found");
                return;
            }

            // Try to find back camera (environment facing)
            const backCamera =
                devices.find((device) =>
                    device.label.toLowerCase().includes("back"),
                ) ||
                devices.find((device) =>
                    device.label.toLowerCase().includes("environment"),
                ) ||
                devices[0];

            selectedCameraId = backCamera.deviceId;
            debug.info(`Selected camera: ${backCamera.label}`);

            isScanning = true;
            startScanning();
        } catch (error) {
            console.error("Camera initialization error:", error);
            debug.error("Camera initialization failed", error);
            errorMessage = `Camera error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
    });

    async function startScanning() {
        isPaused = false;
        isScanning = true;
        isProcessing = false;
        lastScannedCode = "";
        scanFeedback = "";

        debug.info("Restarting scanner...");

        try {
            // Recreate the code reader for a fresh start
            if (codeReader) {
                debug.log("Resetting existing code reader");
            }

            codeReader = new BrowserQRCodeReader();

            // Get devices again
            const devices = await BrowserQRCodeReader.listVideoInputDevices();

            if (devices.length === 0) {
                errorMessage = "No camera devices found";
                debug.error("No camera devices found");
                return;
            }

            // Use the previously selected camera or pick a new one
            const backCamera =
                devices.find(
                    (device) => device.deviceId === selectedCameraId,
                ) ||
                devices.find((device) =>
                    device.label.toLowerCase().includes("back"),
                ) ||
                devices.find((device) =>
                    device.label.toLowerCase().includes("environment"),
                ) ||
                devices[0];

            selectedCameraId = backCamera.deviceId;

            await codeReader.decodeFromVideoDevice(
                selectedCameraId,
                videoEl,
                async (result, err) => {
                    if (result && !isProcessing) {
                        const raw = result.getText();

                        // Debounce - don't scan the same code twice in a row
                        if (raw === lastScannedCode) {
                            return;
                        }

                        isProcessing = true;
                        lastScannedCode = raw;

                        try {
                            debug.log("QR Code detected", { raw });
                            const parsed = parseQR(raw);
                            debug.info("QR Code parsed", parsed);

                            const id = crypto.randomUUID();

                            await scans.add({
                                id,
                                raw_scan_data: raw,
                                parsed,
                                scanned_at: Date.now(),
                                synced: false,
                            });

                            debug.log("Scan saved to IndexedDB", { id });

                            // Pause scanning and show success
                            isPaused = true;
                            isScanning = false;
                            scanFeedback = "✓ Scanned successfully!";

                            // Stop the video stream
                            if (videoEl && videoEl.srcObject) {
                                const stream = videoEl.srcObject as MediaStream;
                                stream
                                    .getTracks()
                                    .forEach((track) => track.stop());
                            }

                            isProcessing = false;
                        } catch (error) {
                            console.error("Error saving scan:", error);
                            debug.error("Error saving scan", error);
                            scanFeedback = "✗ Error saving scan";
                            setTimeout(() => {
                                scanFeedback = "";
                                isProcessing = false;
                            }, 2000);
                        }
                    }

                    if (err && !(err.name === "NotFoundException")) {
                        console.error("Scan error:", err);
                    }
                },
            );
        } catch (error) {
            console.error("Error starting scanner:", error);
            debug.error("Scanner start failed", error);
            errorMessage = `Scanner error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
    }

    onDestroy(() => {
        if (codeReader) {
            // Stop all video tracks
            if (videoEl && videoEl.srcObject) {
                const stream = videoEl.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
            }
        }
        isScanning = false;
    });
</script>

<div class="relative w-full h-screen bg-black overflow-hidden">
    {#if errorMessage}
        <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="bg-red-600 text-white p-6 rounded-lg max-w-md">
                <h2 class="text-xl font-bold mb-2">Camera Error</h2>
                <p>{errorMessage}</p>
                <p class="mt-4 text-sm">
                    Please ensure camera permissions are granted.
                </p>
            </div>
        </div>
    {:else}
        <video
            bind:this={videoEl}
            class="w-full h-full object-cover"
            autoplay
            muted
            playsinline
        ></video>

        <!-- Scanning overlay -->
        <div class="absolute inset-0 pointer-events-none">
            <!-- Scan frame -->
            <div
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white rounded-lg"
            >
                <div
                    class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"
                ></div>
                <div
                    class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"
                ></div>
                <div
                    class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"
                ></div>
                <div
                    class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"
                ></div>
            </div>

            <!-- Instructions -->
            <div class="absolute top-8 left-0 right-0 text-center">
                <p
                    class="text-white text-lg font-semibold bg-black/50 inline-block px-4 py-2 rounded"
                >
                    {#if isScanning}
                        Position QR code within frame
                    {:else}
                        Initializing camera...
                    {/if}
                </p>
            </div>

            <!-- Feedback message -->
            {#if scanFeedback}
                <div class="absolute bottom-20 left-0 right-0 text-center">
                    <div
                        class="inline-block px-6 py-3 rounded-lg text-white text-lg font-bold {scanFeedback.includes(
                            '✓',
                        )
                            ? 'bg-green-600'
                            : 'bg-red-600'}"
                    >
                        {scanFeedback}
                    </div>
                </div>
            {/if}

            {#if isPaused}
                <!-- Paused Overlay -->
                <div
                    class="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-50 pointer-events-auto"
                >
                    <div
                        class="text-center max-w-md w-full pointer-events-auto"
                    >
                        <div
                            class="mb-6 text-6xl animate-bounce"
                            style="animation-duration: 0.5s; animation-iteration-count: 1;"
                        >
                            ✅
                        </div>
                        <div class="text-white text-2xl font-bold mb-2">
                            Scan Successful!
                        </div>
                        <div class="text-green-300 text-lg mb-8">
                            Data saved to local storage
                        </div>
                        <div
                            class="flex flex-col sm:flex-row gap-4 pointer-events-auto"
                        >
                            <button
                                type="button"
                                onclick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    debug.log("Scan Again button clicked");
                                    startScanning();
                                }}
                                ontouchstart={(e) => {
                                    e.preventDefault();
                                    debug.log("Scan Again button touched");
                                    startScanning();
                                }}
                                class="px-8 py-4 text-white rounded-lg text-xl font-bold shadow-lg hover:bg-[#6B5A42] active:scale-95 transition-transform cursor-pointer pointer-events-auto touch-none"
                                style="background-color: #8B7355;"
                            >
                                📷 Scan Again
                            </button>
                            <a
                                href="/scans"
                                onclick={(e) => {
                                    debug.log("View Scans button clicked");
                                }}
                                ontouchstart={() => {
                                    debug.log("View Scans button touched");
                                }}
                                class="px-8 py-4 text-white rounded-lg text-xl font-bold shadow-lg hover:bg-[#5A7A1F] active:scale-95 transition-transform inline-flex items-center justify-center cursor-pointer pointer-events-auto no-underline"
                                style="background-color: #6B8E23;"
                            >
                                📋 View Scans
                            </a>
                        </div>
                    </div>
                </div>
            {/if}

            {#if isProcessing}
                <div class="absolute bottom-20 left-0 right-0 text-center">
                    <div
                        class="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white text-lg"
                    >
                        Processing...
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>
