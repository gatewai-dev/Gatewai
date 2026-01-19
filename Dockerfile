# Stage 0: Base setup
FROM node:22-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV GRPC_POLL_STRATEGY=epoll1

# Stage 1: Pruner
FROM base AS pruner
RUN npm install -g turbo
COPY . .
# Prune creates a subset of the monorepo for the specific target
RUN turbo prune @gatewai/fe --docker

# Stage 2: Builder
FROM base AS builder
RUN apt-get update && apt-get install -y \
    python3 build-essential python-is-python3 libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev libgl1-mesa-dev \
    libglew-dev pkg-config \
    libx11-dev libxi-dev libxext-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy pruned json/lockfiles
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install all dependencies (including devDeps for building)
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts

# Rebuild native modules for the current architecture
RUN pnpm rebuild canvas sharp

# Copy the actual source code
COPY --from=pruner /app/out/full/ .

# IMPORTANT: Generate Prisma/DB types first so they are available for the build
RUN pnpm run db:generate

# Build the app AND all its internal workspace dependencies (@gatewai/db, @gatewai/types, etc.)
# The "..." is the magic suffix that includes dependencies in the build order.
RUN pnpm run build --filter=@gatewai/fe...

# Deploy production-ready folder (isolates only what's needed for runtime)
RUN pnpm deploy --filter=@gatewai/fe --prod --legacy /app/deploy
RUN cp -r apps/gatewai-fe/dist /app/deploy/dist
RUN cp -r apps/gatewai-fe/backend/dist /app/deploy/backend/dist

# Stage 3: Runner
FROM base AS runner

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 gatewai

RUN apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libgl1-mesa-glx libgl1-mesa-dri ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=gatewai:nodejs /app/deploy .

# Ensure pnpm is available in the runner for the start script
RUN corepack enable

USER gatewai
EXPOSE 8081


CMD ["pnpm", "run", "start-cli"]