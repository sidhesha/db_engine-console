# db_engine-console

A browser-based SQL console for [`db_engine`](https://github.com/sidhesha/db_engine) — a relational
database engine written from scratch in C++17 (B+ tree index, write-ahead log, MVCC transactions, a
real SQL frontend served over TCP).

A browser can't open a raw TCP socket, so this repo is a thin bridge plus a minimal frontend that
lets you run real SQL against the real engine from a browser tab.

## How it works

```
Browser (plain HTML/CSS/JS, no build step)
   │  WebSocket
   ▼
backend/server.js — a dumb pipe, no SQL knowledge
   │  one fresh TCP connection per WebSocket connection
   ▼
db_engine's SqlServer (the real engine, spawned as a child process)
```

The bridge never parses SQL. One browser tab's WebSocket connection maps 1:1 to one TCP connection
to `db_engine`, which is what makes `BEGIN`/`COMMIT` session state work correctly with almost no
code in the bridge — `db_engine` already tracks transaction state per connection (see its
[SQL frontend](https://github.com/sidhesha/db_engine/blob/master/docs/ROADMAP.md)); the bridge just
has to not get in the way of that.

## Run it locally

You need a `db_engine` binary. Either build it from the
[`db_engine`](https://github.com/sidhesha/db_engine) repo directly, or build this repo's Docker
image (which builds it from source automatically):

```bash
docker build -t db-engine-console .
docker run -p 8080:8080 db-engine-console
```

Then serve `frontend/` with any static file server (e.g. `npx http-server frontend -p 5500`) and
open it in a browser — `frontend/config.js` defaults to `ws://localhost:8080`.

To run the backend directly instead of via Docker:

```bash
cd backend
npm install
ENGINE_BINARY=/path/to/db_engine node server.js
```

## Repo layout

```
db_engine-console/
├── backend/           The WebSocket<->TCP bridge (Node.js, ws)
│   └── test_ws_client.js   A tiny headless client for testing the bridge without a browser
├── frontend/          Static SQL console (no build step)
├── Dockerfile          Multi-stage: builds db_engine from a pinned commit, then bundles it with the bridge
├── render.yaml         Render Blueprint for the backend (free tier)
└── .github/workflows/
    ├── docker-build.yml   CI: builds and smoke-tests the Docker image on every push
    └── deploy-pages.yml   Publishes frontend/ to GitHub Pages on every push to master
```

## Deploying

**Backend** (Render, free tier): create a Render account, "New +" → "Blueprint", point it at this
repo — `render.yaml` is picked up automatically. Free-tier services sleep after ~15 min idle and
take ~30-60s to wake on the next request; an accepted tradeoff for an occasionally-visited link, not
a bug.

**Frontend** (GitHub Pages, free): in this repo's Settings → Pages, set Source to "GitHub Actions"
(one-time). `.github/workflows/deploy-pages.yml` then publishes `frontend/` on every push to
`master`.

Once the backend has a real URL, point the frontend at it by editing `frontend/config.js`:

```js
window.DB_ENGINE_WS_URL = "wss://<your-render-service>.onrender.com";
```

## Wire protocol

The bridge forwards `db_engine`'s own protocol byte-for-byte — see
[`db_engine`'s README](https://github.com/sidhesha/db_engine#readme) for the exact format
(`;`-terminated SQL in, `|`-delimited rows and `OK`/`ERROR` status lines out).

## License

[MIT](LICENSE)
