# Stage 0: Base setup
FROM node:22-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV GRPC_POLL_STRATEGY=epoll1

# Stage 1: Pruner
FROM base AS pruner
RUN npm install -g turbo
COPY turbo.json package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/ apps/
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
# 1. Generate Prisma Client (Generates into packages/db/generated/client)
RUN pnpm --filter=@gatewai/db db:generate

ENV NODE_OPTIONS="--max-old-space-size=6144"
# 2. Build the app
RUN pnpm run build --filter=@gatewai/fe...

# 3. Deploy production-ready folder
RUN pnpm deploy --filter=@gatewai/fe --prod --legacy /app/deploy

# Copy Prisma schema for migrations
RUN mkdir -p /app/deploy/packages/db/prisma && \
    cp -r packages/db/prisma/* /app/deploy/packages/db/prisma/


RUN mkdir -p /app/deploy/node_modules/@gatewai/db/dist && \
    cp packages/db/generated/client/libquery_engine-debian-openssl-1.1.x.so.node \
        /app/deploy/node_modules/@gatewai/db/dist/


WORKDIR /app/deploy
RUN pnpm rebuild canvas sharp gl

# We assume backend dists are handled by the deploy/build process,
WORKDIR /app
RUN mkdir -p /app/deploy/backend && \
    cp -r apps/gatewai-fe/backend/dist /app/deploy/backend/dist && \
    cp -r apps/gatewai-fe/dist /app/deploy/dist

# Stage 3: Runner
FROM base AS runner

# Install runtime dependencies for Canvas and Headless-GL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libgl1-mesa-glx libgl1-mesa-dri ffmpeg \
    libxi6 libxext6 libxrender1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -m -g nodejs gatewai

ENV COREPACK_HOME=/home/gatewai/.cache/corepack

WORKDIR /app
# Copy the fully prepared deployment folder
COPY --from=builder --chown=gatewai:nodejs /app/deploy .
RUN corepack enable && \
    mkdir -p /home/gatewai/.cache/corepack && \
    chown -R gatewai:nodejs /home/gatewai


USER gatewai
EXPOSE 8081

# Ensure we use the pnpm from the deployed directory
CMD ["pnpm", "run", "start-cli"]