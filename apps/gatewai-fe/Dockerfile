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

# Copy workspace configuration and lockfile first to cache layers
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Copy internal workspace package.json files
# (Adjust paths if your workspaces are in /packages or /libs)
COPY backend/package.json ./backend/
# COPY packages/db/package.json ./packages/db/ 

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the project
# This will handle tsc -b and vite build across workspaces
RUN pnpm run build
RUN pnpm run be:build

# Stage 2: Runtime environment
FROM node:22-bullseye-slim AS runner

WORKDIR /app

# Install ONLY runtime libraries for canvas/graphics
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Re-enable pnpm in runner to use workspace commands if needed
RUN corepack enable

# Copy production artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/dist ./dist

# Expose backend port
EXPOSE 3000

# Start backend
CMD ["node", "backend/dist/index.js"]