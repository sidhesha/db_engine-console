// Overridden once the backend is actually deployed (Session 4) --
// e.g. window.DB_ENGINE_WS_URL = "wss://db-engine-console.onrender.com";
// Kept as its own file (not baked into app.js) so redeploying the
// backend's URL doesn't touch application logic.
window.DB_ENGINE_WS_URL = window.DB_ENGINE_WS_URL || "ws://localhost:8080";
