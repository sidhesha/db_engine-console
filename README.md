<div align="center">

# db_engine-console

**A browser SQL console for [`db_engine`](https://github.com/sidhesha/db_engine)** — a relational
database engine written from scratch in C++17.

[![Docker Build](https://github.com/sidhesha/db_engine-console/actions/workflows/docker-build.yml/badge.svg)](https://github.com/sidhesha/db_engine-console/actions/workflows/docker-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[**Open the console →**](https://sidhesha.github.io/db_engine-console/)

</div>

---

A browser can't open a raw TCP socket, and `db_engine`'s SQL server speaks exactly one. This repo
is the thin bridge (plus a minimal frontend) that closes that gap — real SQL, against the real
engine, from a browser tab, not a mock or a simulated backend.

<p align="center">
  <a href="https://sidhesha.github.io/db_engine-console/">
    <img src="docs/screenshot.png" alt="db_engine-console — a live SQL session" width="820">
  </a>
</p>

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

## Live deployment

| | |
|---|---|
| Frontend | [sidhesha.github.io/db_engine-console](https://sidhesha.github.io/db_engine-console/) — GitHub Pages, auto-deployed from `frontend/` on every push |
| Backend | Render, free tier — auto-deployed from this repo's `Dockerfile` via `render.yaml` |

Free-tier backend sleeps after ~15 min idle; the first query after a quiet spell takes ~30-60s to
wake it up. Accepted tradeoff for an occasionally-visited link, not a bug.

**Deploying your own copy:** fork this repo, then Render → "New +" → "Blueprint" pointed at your
fork (`render.yaml` handles the rest), and in your fork's Settings → Pages set Source to "GitHub
Actions".

## Run it locally

You need a `db_engine` binary. Either build it from the
[`db_engine`](https://github.com/sidhesha/db_engine) repo directly, or build this repo's Docker
image (which builds it from source automatically):

```bash
docker build -t db-engine-console .
docker run -p 8080:8080 db-engine-console
```

Then serve `frontend/` with any static file server (e.g. `npx http-server frontend -p 5500`) and
open it in a browser — `frontend/config.js` auto-detects localhost and points at
`ws://localhost:8080`.

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

## Redeploying against a newer db_engine

The Docker build tracks `db_engine`'s `master` by default — no manual bumping needed. A cache-busting
`ADD` in `Dockerfile` re-checks `master`'s HEAD on every build, so a plain rebuild always compiles
against the latest commit.

Two things worth knowing:

- **This only refreshes on the next *build*, not automatically the instant `db_engine` changes.**
  Render rebuilds when *this* repo gets pushed to (or on a manual "Clear cache & deploy"). If
  `db_engine` merges a change and nothing pushes here, the deployed engine won't update until
  something triggers a rebuild.
- **To pin instead of track** — for a reproducible build or a rollback — pass a specific commit or
  tag at build time:
  ```bash
  docker build --build-arg DB_ENGINE_REF=b2b5616 -t db-engine-console .
  ```
  (or set `DB_ENGINE_REF` as a Render environment/build variable for the deployed service).

## Wire protocol

The bridge forwards `db_engine`'s own protocol byte-for-byte — see
[`db_engine`'s README](https://github.com/sidhesha/db_engine#readme) for the exact format
(`;`-terminated SQL in, `|`-delimited rows and `OK`/`ERROR` status lines out).

## License

[MIT](LICENSE)
