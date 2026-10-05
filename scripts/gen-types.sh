#!/usr/bin/env bash
# Regenera src/types/database.ts desde una base ya migrada.
#   Local (requiere Docker):  npm run db:types
#   Sin Docker, contra cualquier Postgres migrado:
#     DB_URL='postgresql://postgres@127.0.0.1:5432/postgres?sslmode=disable' npm run db:types:url
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" = "--url" ]; then
  : "${DB_URL:?Definí DB_URL}"
  npx supabase gen types typescript --db-url "$DB_URL" --schema public > src/types/database.ts
else
  npx supabase gen types typescript --local --schema public > src/types/database.ts
fi
npx prettier --write --ignore-path /dev/null src/types/database.ts > /dev/null
echo "src/types/database.ts regenerado"
