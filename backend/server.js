// Thin WebSocket<->TCP bridge. A browser can't open a raw TCP socket, but
// db_engine's SqlServer only speaks one (a ';'-terminated text protocol --
// see db_engine's include/db_engine/sqlserver.hpp). This process spawns
// the real db_engine binary and, for every incoming WebSocket connection,
// opens a brand-new TCP connection to it and forwards bytes verbatim in
// both directions.
//
// Deliberately dumb: this file has zero SQL knowledge. One browser tab's
// WebSocket maps 1:1 to one TCP connection to db_engine, which is what
// makes BEGIN/COMMIT session state (db_engine's own per-connection
// transaction model, see its Phase 6 SQL frontend) work correctly without
// this bridge needing to understand the protocol at all -- it would take
// real complexity (session tracking, connection pooling) to fake that
// with a stateless one-HTTP-request-per-query design instead.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const WebSocket = require('ws');

const ENGINE_HOST = '127.0.0.1';
const ENGINE_PORT = 5433; // hardcoded in db_engine's own src/main.cpp
const BRIDGE_PORT = process.env.PORT || 8080;
const ENGINE_BINARY = process.env.ENGINE_BINARY || path.join(__dirname, 'engine', 'db_engine');

const engine = spawn(ENGINE_BINARY, [], { stdio: ['pipe', 'inherit', 'inherit'] });
engine.on('error', (err) => {
  console.error('failed to start db_engine:', err.message);
  process.exit(1);
});
engine.on('exit', (code, signal) => {
  console.error(`db_engine exited unexpectedly (code=${code}, signal=${signal})`);
  process.exit(1);
});

// Retries with backoff rather than a fixed startup delay: the engine
// needs a moment to bind its listening socket after spawn(), and a fixed
// sleep is either too short (flaky) or wastefully long on every single
// connection. This also transparently covers a connection that happens
// to land during a brief engine hiccup, not just cold start.
function connectToEngine(retriesLeft = 20, delayMs = 250) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const sock = net.createConnection({ host: ENGINE_HOST, port: ENGINE_PORT });
      sock.once('connect', () => resolve(sock));
      sock.once('error', () => {
        sock.destroy();
        if (remaining <= 0) {
          reject(new Error('could not reach db_engine after retrying'));
          return;
        }
        setTimeout(() => attempt(remaining - 1), delayMs);
      });
    };
    attempt(retriesLeft);
  });
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('db_engine bridge is running\n');
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  connectToEngine()
    .then((tcp) => {
      tcp.on('data', (chunk) => {
        // db_engine's wire protocol is plain text (see its README) --
        // sent as a WebSocket *text* frame (not the raw Buffer, which
        // would go out as a binary frame) so a real browser delivers
        // event.data as a string directly, instead of a Blob that
        // needs an extra async read to get text out of.
        if (ws.readyState === WebSocket.OPEN) ws.send(chunk.toString('utf8'));
      });
      tcp.on('close', () => ws.close());
      tcp.on('error', () => ws.close());

      ws.on('message', (data) => tcp.write(data));
      ws.on('close', () => tcp.end());
      ws.on('error', () => tcp.end());
    })
    .catch((err) => {
      console.error('bridge could not reach db_engine:', err.message);
      ws.close();
    });
});

httpServer.listen(BRIDGE_PORT, () => {
  console.log(`bridge listening on :${BRIDGE_PORT}, forwarding to db_engine at ${ENGINE_HOST}:${ENGINE_PORT}`);
});

// db_engine's own main() blocks reading stdin for a "quit" line as its
// shutdown signal (see db_engine's src/main.cpp) -- it never sees EOF
// here because Node keeps this pipe's write end open until we explicitly
// end it, so the engine just runs until told otherwise, exactly as
// intended. On a container stop (SIGTERM) or Ctrl+C locally, ask it to
// shut down cleanly instead of leaving it to be SIGKILLed.
function shutdown() {
  engine.stdin.write('quit\n');
  engine.stdin.end();
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
