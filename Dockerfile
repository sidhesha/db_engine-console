# --- Stage 1: build the real db_engine binary from source -------------------
# Pinned to a specific commit (not a moving branch) for reproducible
# builds -- bump this once db_engine's Linux port (PR #16) merges to
# master, or whenever a newer db_engine commit should be deployed.
#
# Built from the *same* base image as the runtime stage below
# (node:22-slim), not a generic ubuntu image -- a binary compiled against
# a newer glibc/libstdc++ than the runtime image ships fails to even
# start ("version `GLIBCXX_3.4.32' not found"), a classic multi-stage
# Docker pitfall. Confirmed the hard way: an earlier ubuntu:24.04 build
# stage produced exactly that error in CI (no local Docker available to
# have caught this before pushing).
FROM node:22-slim AS engine-build
ARG DB_ENGINE_REF=1ac01e8c65da50d2beca2fe57bc426c27c868a32
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/sidhesha/db_engine.git /src \
    && cd /src && git checkout "${DB_ENGINE_REF}"
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
