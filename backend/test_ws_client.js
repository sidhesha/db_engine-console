// A tiny headless client for exercising the bridge without a browser --
// useful when iterating on backend/server.js. Run the bridge first
// (`ENGINE_BINARY=... node server.js`), then `node test_ws_client.js`.
const WebSocket = require('ws');

const BRIDGE_URL = process.env.BRIDGE_URL || 'ws://127.0.0.1:8080';
const ws = new WebSocket(BRIDGE_URL);
const stmts = [
  "CREATE TABLE users (id string PRIMARY KEY, name string, age int);",
  "INSERT INTO users VALUES ('1', 'Alice', 30);",
  "INSERT INTO users VALUES ('2', 'Bob', 25);",
  "SELECT * FROM users WHERE age > 26;",
  "BEGIN;",
  "UPDATE users SET age = 31 WHERE id = '1';",
  "ROLLBACK;",
];
let i = 0;

ws.on('open', () => {
  console.log('[connected]');
  send();
});

function send() {
  if (i >= stmts.length) {
    ws.close();
    return;
  }
  console.log('>>> ' + stmts[i]);
  ws.send(stmts[i]);
  i++;
}

ws.on('message', (data) => {
  process.stdout.write(data.toString());
  setTimeout(send, 100);
});

ws.on('close', () => {
  console.log('[closed]');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('[error]', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('[timeout]');
  process.exit(1);
}, 10000);
