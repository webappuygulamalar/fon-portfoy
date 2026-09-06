import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App";

// `immediate: true` + workbox skipWaiting/clientsClaim: yeni bir dağıtım
// bulunduğunda service worker hemen etkinleşir ve sayfa otomatik yenilenir.
// Bu olmadan kullanıcılar sekmeyi kapatıp yeniden açana kadar ESKİ,
// önbelleğe alınmış sürümü görmeye devam edebilir.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
