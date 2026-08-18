// No SQL parsing or response framing here -- the backend bridge is a
// dumb pipe (see backend/server.js), so this just streams whatever comes
// back from the WebSocket into the output pane as it arrives, exactly
// like a raw `nc` session would show it. The wire protocol itself (one
// response per ';'-terminated statement, '|'-delimited SELECT rows) is
// db_engine's own -- see its README for the exact format.
(function () {
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const sqlEl = document.getElementById("sql");
  const runBtn = document.getElementById("run");
  const clearBtn = document.getElementById("clear");
  const examplesEl = document.getElementById("examples");

  let ws = null;
  let connected = false;
  let reconnectDelayMs = 1000;

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "status " + cls;
  }

  function appendOutput(text) {
    outputEl.textContent += text;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function connect() {
    setStatus("connecting…", "status-connecting");
    ws = new WebSocket(window.DB_ENGINE_WS_URL);

    ws.onopen = () => {
      connected = true;
      reconnectDelayMs = 1000;
      setStatus("connected", "status-connected");
    };
    ws.onclose = () => {
      connected = false;
      setStatus("disconnected — retrying…", "status-disconnected");
      setTimeout(connect, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => appendOutput(event.data);
  }

  function runQuery() {
    const sql = sqlEl.value.trim();
    if (!sql || !connected) return;
    appendOutput("> " + sql + "\n");
    // The wire protocol is ';'-terminated -- always send one, even if
    // the user forgot it.
    ws.send(sql.endsWith(";") ? sql : sql + ";");
  }

  runBtn.addEventListener("click", runQuery);
  clearBtn.addEventListener("click", () => { outputEl.textContent = ""; });
  sqlEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runQuery();
    }
  });
  examplesEl.addEventListener("change", () => {
    if (examplesEl.value) {
      sqlEl.value = examplesEl.value;
      sqlEl.focus();
    }
    examplesEl.value = "";
  });

  connect();
})();
