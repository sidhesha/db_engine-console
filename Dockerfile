# --- Stage 1: build the real db_engine binary from source -------------------
# Tracks db_engine's master by default -- DB_ENGINE_REF can still be set to
# a specific commit/tag at build time (--build-arg) to pin for a reproducible
# build or a rollback.
#
# The ADD below is the standard Docker cache-busting trick for "always pull
# latest": ADD-from-URL re-fetches on every build and only counts as a cache
# hit if the response is byte-identical, so as soon as db_engine's master
# moves, this layer (and every layer after it, including the git clone)
# invalidates and rebuilds. Without it, Docker would happily cache the
# `git clone` forever and this would silently stop tracking master the
# moment the layer cache was warm.
#
# Built from the *same* base image as the runtime stage below
# (node:22-slim), not a generic ubuntu image -- a binary compiled against
# a newer glibc/libstdc++ than the runtime image ships fails to even
# start ("version `GLIBCXX_3.4.32' not found"), a classic multi-stage
# Docker pitfall. Confirmed the hard way: an earlier ubuntu:24.04 build
# stage produced exactly that error in CI (no local Docker available to
# have caught this before pushing).
FROM node:22-slim AS engine-build
ARG DB_ENGINE_REF=master
ADD https://api.github.com/repos/sidhesha/db_engine/commits/${DB_ENGINE_REF} /tmp/db_engine_version.json
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --branch "${DB_ENGINE_REF}" --depth 1 https://github.com/sidhesha/db_engine.git /src \
    || (git clone https://github.com/sidhesha/db_engine.git /src && cd /src && git checkout "${DB_ENGINE_REF}")
RUN cmake -S /src -B /src/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /src/build --target db_engine -j"$(nproc)"

# --- Stage 2: runtime ---------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/server.js ./
COPY --from=engine-build /src/build/db_engine ./engine/db_engine

ENV ENGINE_BINARY=/app/engine/db_engine
EXPOSE 8080
CMD ["node", "server.js"]
