#!/bin/sh
set -e

# Sync the Prisma schema with the database. Without --accept-data-loss this
# refuses destructive changes, so a risky schema change fails the deploy instead
# of dropping data.
if [ "${SKIP_DB_PUSH:-0}" != "1" ]; then
  node node_modules/prisma/build/index.js db push --skip-generate
fi

exec "$@"
