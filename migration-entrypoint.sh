#!/usr/bin/env bash
set -euo pipefail

echo "=== Starting Database Migration ==="

# Validate environment
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "DATABASE_URL is configured"

# Wait for database to be ready
MAX_RETRIES=30
COUNT=0

echo "Waiting for database to be ready..."
until npx prisma db execute --schema ./packages/db/prisma/schema.prisma --stdin <<< "SELECT 1;" 2>/dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  echo "Database not ready yet... (Attempt $((COUNT+1))/$MAX_RETRIES)"
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Database connection failed after $MAX_RETRIES attempts."
  exit 1
fi

echo "Database is ready!"

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy --schema ./packages/db/prisma/schema.prisma

if [ $? -eq 0 ]; then
  echo "✓ Migrations completed successfully!"
  exit 0
else
  echo "✗ Migration failed!"
  exit 1
fi