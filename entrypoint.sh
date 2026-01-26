#!/usr/bin/env bash
set -euo pipefail

# 1. Validate environment
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# 2. Parse DATABASE_URL for connectivity checks
DB_STRING="${DATABASE_URL#postgresql://}"
DB_STRING="${DB_STRING#postgres://}"

DB_USER_PASS="${DB_STRING%%@*}"
DB_USER="${DB_USER_PASS%%:*}"

DB_HOST_PORT_DB="${DB_STRING#*@}"
DB_HOST_PORT="${DB_HOST_PORT_DB%%/*}"
DB_HOST="${DB_HOST_PORT%%:*}"
# Default to 5432 if port is not specified in the URL
DB_PORT="${DB_HOST_PORT#*:}"
if [ "$DB_PORT" = "$DB_HOST" ]; then DB_PORT=5432; fi

# 3. Wait for PostgreSQL to be reachable
echo "Waiting for PostgreSQL server at $DB_HOST:$DB_PORT..."
timeout=60
elapsed=0
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  if [ $elapsed -ge $timeout ]; then
    echo "ERROR: PostgreSQL not ready after ${timeout}s"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

# 4. Run Migrations
echo "PostgreSQL is up. Running migrations..."
cd /app

if ! npx prisma migrate deploy --schema ./packages/db/prisma/schema.prisma; then
  echo "ERROR: Migration failed!"
  exit 1
fi

echo "Migrations completed successfully!"

# 5. Hand off to CMD
exec "$@"