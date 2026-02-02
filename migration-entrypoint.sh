#!/usr/bin/env bash
set -euo pipefail

echo "=== Starting Database Migration ==="
echo "Working directory: $(pwd)"
echo "Contents:"
ls -la

# Validate environment
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Redact password from URL for logging
SAFE_URL=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/USER:PASS@/')
echo "DATABASE_URL: $SAFE_URL"

# Extract connection details
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_PORT=${DB_PORT:-5432}

echo "Connecting to: ${DB_HOST}:${DB_PORT}"

# Check if Prisma schema exists
SCHEMA_PATH="./prisma/schema.prisma"
if [ ! -f "$SCHEMA_PATH" ]; then
  echo "ERROR: Prisma schema not found at $SCHEMA_PATH"
  echo "Available files:"
  find . -name "schema.prisma" 2>/dev/null || echo "No schema.prisma found"
  exit 1
fi

echo "✓ Found Prisma schema at $SCHEMA_PATH"

# Check for Prisma CLI in node_modules
if [ ! -f "./node_modules/.bin/prisma" ]; then
  echo "ERROR: Prisma CLI not found in node_modules/.bin/"
  echo "Available binaries:"
  ls -la ./node_modules/.bin/ 2>/dev/null || echo "No binaries found"
  exit 1
fi

echo "✓ Found Prisma CLI at ./node_modules/.bin/prisma"

# Use direct path to Prisma CLI
PRISMA_CLI="./node_modules/.bin/prisma"

# TODO: rm
echo "Running Prisma migrations reset..."
$PRISMA_CLI migrate reset --force

# Run migrations using direct path to Prisma
echo "Running Prisma migrations..."
$PRISMA_CLI migrate deploy

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo "✓ Migrations completed successfully!"
  exit 0
else
  echo "✗ Migration failed with exit code: $MIGRATION_EXIT_CODE"
  exit 1
fi