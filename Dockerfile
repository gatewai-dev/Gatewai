# Stage 1: Pruner
FROM node:22-bullseye-slim AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @gatewai/fe --docker

# Stage 2: Builder
FROM node:22-bullseye-slim AS builder
WORKDIR /app

# Build-time dependencies for node-canvas and headless-gl
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libgl1-mesa-dev \
    libglew-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Build the project
RUN pnpm run build --filter=@gatewai/fe...
RUN pnpm run be:build --filter=@gatewai/fe...

# Deploy the application to a separate directory with production dependencies
RUN pnpm deploy --filter=@gatewai/fe --prod /app/deploy

# Copy build artifacts to the deploy directory (since pnpm deploy might exclude ignored files)
# We need to copy the dist folder and the backend/dist folder
RUN cp -r apps/gatewai-fe/dist /app/deploy/dist
RUN cp -r apps/gatewai-fe/backend/dist /app/deploy/backend/dist

# Stage 3: Runner
FROM node:22-bullseye-slim AS runner
WORKDIR /app

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV GRPC_POLL_STRATEGY=epoll1

COPY --from=builder /app/deploy .

EXPOSE 8081

CMD ["node", "backend/dist/index.js"]