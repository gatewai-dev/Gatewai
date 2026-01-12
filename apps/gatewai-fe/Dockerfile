# Stage 1: Build environment
FROM node:22-bullseye-slim AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install system dependencies for node-canvas, sharp, and native builds
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build
RUN pnpm run be:build

# Stage 2: Runtime environment
FROM node:22-bullseye-slim AS runner

WORKDIR /app

# Install Runtime libraries for Canvas AND Headless Browser dependencies
RUN apt-get update && apt-get install -y \
    # Original Canvas/Graphics runtimes
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    # New requested dependencies (Chromium/Puppeteer/Playwright deps)
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libgbm-dev \
    libcups2 \
    libatk-bridge2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
RUN corepack enable

# Copy production artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]