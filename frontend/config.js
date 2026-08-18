// Auto-detects environment rather than needing a manual toggle before
// each deploy: local dev (served from localhost/127.0.0.1) talks to a
// locally-running bridge; anywhere else (the real GitHub Pages site)
// talks to the deployed Render backend.
window.DB_ENGINE_WS_URL =
  window.DB_ENGINE_WS_URL ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "ws://localhost:8080"
    : "wss://db-engine-console.onrender.com");
