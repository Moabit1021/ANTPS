#!/bin/sh
set -e

echo "Running database schema push..."
npx prisma db push --accept-data-loss --skip-generate 2>&1 || {
  echo "prisma db push failed, trying with SQL migrations..."
  # Apply SQL migrations manually if prisma db push fails
  for f in prisma/migrations/*.sql; do
    if [ -f "$f" ]; then
      echo "Applying migration: $f"
      npx prisma db execute --file "$f" --schema prisma/schema.prisma 2>&1 || true
    fi
  done
  # Retry push after manual migrations
  npx prisma db push --accept-data-loss --skip-generate 2>&1
}

# Apply pgvector migration if extension is available (optional, non-blocking)
echo "Attempting pgvector setup (optional)..."
for f in prisma/migrations/*/migration.sql; do
  if [ -f "$f" ]; then
    echo "Applying: $f"
    npx prisma db execute --file "$f" --schema prisma/schema.prisma 2>&1 || echo "Skipped (pgvector not available - semantic search will be disabled)"
  fi
done

echo "Running seed..."
node prisma/seed-prod.js

echo "Starting server..."
exec node server.js
