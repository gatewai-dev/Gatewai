# Stage 0: Base setup for shared environment variables
FROM node:22-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV GRPC_POLL_STRATEGY=epoll1

# Stage 1: Pruner
FROM base AS pruner
RUN npm install -g turbo
COPY . .
RUN turbo prune @gatewai/fe --docker

# Stage 2: Builder
FROM base AS builder
# Install build-time dependencies
RUN apt-get update && apt-get install -y \
    python3 build-essential python-is-python3 libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev libgl1-mesa-dev \
    libglew-dev pkg-config \
    libx11-dev libxi-dev libxext-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN corepack enable && pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Build artifacts
RUN pnpm run build --filter=@gatewai/fe...
RUN pnpm run be:build --filter=@gatewai/fe...

# Deploy production-ready folder
RUN pnpm deploy --filter=@gatewai/fe --prod /app/deploy
RUN cp -r apps/gatewai-fe/dist /app/deploy/dist
RUN cp -r apps/gatewai-fe/backend/dist /app/deploy/backend/dist

# Stage 3: Runner
FROM base AS runner

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 gatewai

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libgl1-mesa-glx libgl1-mesa-dri ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy from builder and set ownership to the non-root user
COPY --from=builder --chown=gatewai:nodejs /app/deploy .

# Switch to non-root user
USER gatewai

EXPOSE 8081

CMD ["pnpm", "run" "start"]