# Stage 0: Base setup
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
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential git ca-certificates libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev libgl1-mesa-dev \
    libglew-dev pkg-config libx11-dev libxi-dev libxext-dev \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN corepack enable && pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# IMPORTANT: Generate Prisma Client 
# We run this BEFORE pnpm deploy so the generated files exist to be copied
RUN pnpm run db:generate

# Build the app
RUN pnpm run build --filter=@gatewai/fe...

# Deploy production-ready folder
RUN pnpm deploy --filter=@gatewai/fe --prod --legacy /app/deploy

# --- FIX FOR PRISMA ENGINES ---
# Manually copy the generated prisma engine to the deploy folder if it's missing
# This ensures the .so.node file is available to the runner
RUN cp -r packages/db/node_modules/.prisma /app/deploy/node_modules/ || true
# ------------------------------

WORKDIR /app/deploy
RUN pnpm rebuild canvas sharp gl

WORKDIR /app
RUN mkdir -p /app/deploy/backend && \
    cp -r apps/gatewai-fe/backend/dist /app/deploy/backend/dist && \
    cp -r apps/gatewai-fe/dist /app/deploy/dist

# Stage 3: Runner
FROM base AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libgl1-mesa-glx libgl1-mesa-dri ffmpeg \
    libxi6 libxext6 libxrender1 libasound2 openssl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -m -g nodejs gatewai

WORKDIR /app
COPY --from=builder --chown=gatewai:nodejs /app/deploy .

# Create a startup script to run migrations
RUN echo '#!/bin/sh\n\
pnpm --filter @gatewai/db db:deploy\n\
pnpm run start-cli' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

USER gatewai
EXPOSE 8081

# Use the entrypoint script
CMD ["/app/entrypoint.sh"]