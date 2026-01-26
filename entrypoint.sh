#!/usr/bin/env bash
set -euo pipefail

# Extract database configuration from DATABASE_URL
# Expected format: postgresql://user:password@host:port/database
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Parse DATABASE_URL
# Remove the protocol prefix
DB_STRING="${DATABASE_URL#postgresql://}"
DB_STRING="${DB_STRING#postgres://}"

# Extract user and password
DB_USER_PASS="${DB_STRING%%@*}"
DB_USER="${DB_USER_PASS%%:*}"
DB_PASSWORD="${DB_USER_PASS#*:}"

# Extract host, port, and database
DB_HOST_PORT_DB="${DB_STRING#*@}"
DB_HOST_PORT="${DB_HOST_PORT_DB%%/*}"
DB_HOST="${DB_HOST_PORT%%:*}"
DB_PORT="${DB_HOST_PORT#*:}"
DB_NAME="${DB_HOST_PORT_DB#*/}"

# Remove any query parameters from DB_NAME
DB_NAME="${DB_NAME%%\?*}"

echo "Database configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

echo "Waiting for PostgreSQL server..."
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

echo "PostgreSQL server is ready."

# Check if database exists, create if it doesn't
echo "Checking if database '$DB_NAME' exists..."
export PGPASSWORD="$DB_PASSWORD"

DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" != "1" ]; then
  echo "Database '$DB_NAME' does not exist. Creating..."
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$DB_NAME\";"; then
    echo "ERROR: Failed to create database '$DB_NAME'"
    exit 1
  fi
  echo "Database '$DB_NAME' created successfully."
else
  echo "Database '$DB_NAME' already exists."
fi

unset PGPASSWORD

echo "Running migrations..."
cd /app

if ! npx prisma migrate deploy --schema ./packages/db/prisma/schema.prisma; then
  echo "ERROR: Migration failed!"
  exit 1
fi

echo "Migrations completed successfully!"

# Execute the CMD or any arguments passed to the container
exec "$@"