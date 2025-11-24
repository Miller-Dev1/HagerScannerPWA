import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

export default {
  server: {
    host: true,
    https: {
      key: fs.readFileSync(path.resolve("certs/key.pem")),
      cert: fs.readFileSync(path.resolve("certs/cert.pem")),
    },
  },
  plugins: [
    sveltekit(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Lumber Scanner",
        short_name: "Scanner",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
};
