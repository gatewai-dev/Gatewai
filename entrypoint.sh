#!/usr/bin/env bash
set -euo pipefail

# 1. Validate environment
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# 2. Migration Loop
# This replaces the need for pg_isready by trying the migration directly
echo "Attempting to run migrations..."
cd /app

MAX_RETRIES=30
COUNT=0

# Loop until prisma can connect and run or we hit the timeout
until npx prisma migrate deploy --schema ./packages/db/prisma/schema.prisma || [ $COUNT -eq $MAX_RETRIES ]; do
  echo "Database not ready yet... (Attempt $((COUNT+1))/$MAX_RETRIES)"
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Migration failed after $MAX_RETRIES attempts."
  exit 1
fi

echo "Migrations completed successfully!"

# 3. Hand off to CMD
exec "$@"