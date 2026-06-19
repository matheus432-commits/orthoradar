#!/bin/sh
set -e

echo "Applying migrations..."
for f in $(ls /app/migrations/*.sql | sort); do
  echo "  -> $f"
  psql "$DATABASE_URL" -f "$f" || true
done

echo "Starting server..."
exec node /app/packages/api/dist/server.js
