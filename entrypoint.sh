#!/bin/sh
set -e

# Run migrations
pnpm run db:migrate

# Start the application
exec "$@"