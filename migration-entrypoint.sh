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

# Wait for TCP connection
MAX_RETRIES=30
COUNT=0

echo "Waiting for database TCP connection..."
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  echo "Waiting for ${DB_HOST}:${DB_PORT}... (Attempt $((COUNT+1))/$MAX_RETRIES)"
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Cannot reach database at ${DB_HOST}:${DB_PORT}"
  exit 1
fi

echo "✓ Database TCP connection established"

# Additional wait for database to be fully ready
echo "Waiting for database to be fully initialized..."
sleep 5

# Test database connection with Prisma
echo "Testing Prisma database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1;" 2>&1; then
  echo "ERROR: Prisma cannot connect to database"
  echo "Attempting to show Prisma version and debug info..."
  npx prisma --version
  exit 1
fi

echo "✓ Prisma database connection successful"

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo "✓ Migrations completed successfully!"
  exit 0
else
  echo "✗ Migration failed with exit code: $MIGRATION_EXIT_CODE"
  exit 1
fi