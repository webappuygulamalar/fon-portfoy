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
        // Varsayılan enjekte edilen script yalnızca service worker'ı
        // kaydeder, güncellemeleri AKTİF OLARAK denetlemez/uygulamaz —
        // bu yüzden bir dağıtımdan sonra kullanıcılar sekmeyi kapatıp
        // yeniden açana kadar (bazen daha da uzun) ESKİ, önbelleğe
        // alınmış sürümü görmeye devam edebilir. Bunun yerine main.tsx'te
        // `virtual:pwa-register`'ın `registerSW({ immediate: true })`'ı
        // kullanılıyor; bu, registerType: "autoUpdate" ile birlikte yeni
        // bir sürüm bulunduğunda service worker'ı hemen etkinleştirip
        // sayfayı otomatik yeniler.
        injectRegister: false,
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
          // Yeni service worker'ın etkin olan(lar)ı beklemeden hemen devreye
          // girmesini sağlar (registerSW'nin auto-reload'ıyla birlikte).
          skipWaiting: true,
          clientsClaim: true,
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
