#!/bin/bash
set -e

echo "Waiting for postgres..."
while ! pg_isready -h postgres -p 5432 -U postgres; do
  sleep 1
done

echo "PostgreSQL is ready. Running migrations..."
cd /app
pnpm add -g prisma
npx prisma migrate deploy --schema ./packages/db/prisma/schema.prisma

echo "Migrations completed successfully!"