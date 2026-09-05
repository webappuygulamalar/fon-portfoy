/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages proje sitesi olarak /fon-portfoy/ altında yayınlanır.
// Yerel geliştirmede kök path kullanılır.
export default defineConfig(({ command }) => {
  const base = command === "build" ? "/fon-portfoy/" : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/icon-mask.svg"],
        manifest: {
          name: "Fon Portföy",
          short_name: "Fon Portföy",
          description:
            "Katılım fonları bilgilendirme ve model portföy pay hesaplama uygulaması. Yatırım tavsiyesi değildir.",
          lang: "tr",
          theme_color: "#0b1a15",
          background_color: "#0b1a15",
          display: "standalone",
          orientation: "portrait-primary",
          scope: base,
          start_url: base,
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: true,
    },
  };
});
