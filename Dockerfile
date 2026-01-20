# Stage 0: Base setup
FROM node:22-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV GRPC_POLL_STRATEGY=epoll1

# Stage 1: Pruner
FROM base AS pruner
RUN npm install -g turbo
# Copy minimal configs for prune (cache hit if these don't change)
COPY turbo.json package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/ apps/
# Prune creates a subset of the monorepo for the specific target
RUN turbo prune @gatewai/fe --docker

# Stage 2: Builder
FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev libgl1-mesa-dev \
    libglew-dev pkg-config libx11-dev libxi-dev libxext-dev \
    && rm -rf /var/lib/apt/lists/*
# Copy pruned json/lockfiles (install deps before full source for cache)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install all dependencies (including devDeps for building)
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts

# Rebuild native modules for the current architecture
RUN pnpm rebuild canvas sharp

# Copy the actual source code (after deps for better cache)
COPY --from=pruner /app/out/full/ .

# IMPORTANT: Generate Prisma/DB types first so they are available for the build
RUN pnpm run db:generate

# Build the app
RUN pnpm run build --filter=@gatewai/fe...

# Deploy production-ready folder (isolates only what's needed for runtime, prod deps only)
RUN pnpm deploy --filter=@gatewai/fe --prod --legacy /app/deploy
# Consolidated cp for dist folders
RUN cp -r apps/gatewai-fe/{dist,backend/dist} /app/deploy/

# Stage 3: Runner
FROM base AS runner

# Install minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libgl1-mesa-glx libgl1-mesa-dri ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create the system group and user with home dir
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -m -g nodejs gatewai

# Set Corepack cache to writable user dir
ENV COREPACK_HOME=/home/gatewai/.cache/corepack

WORKDIR /app
# Copy deployed app with chown (minimal files only)
COPY --from=builder --chown=gatewai:nodejs /app/deploy .

# Enable corepack and ensure user owns cache dir
RUN corepack enable && \
    mkdir -p /home/gatewai/.cache/corepack && \
    chown -R gatewai:nodejs /home/gatewai

USER gatewai
EXPOSE 8081

CMD ["pnpm", "run", "start-cli"]