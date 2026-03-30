#!/usr/bin/env bash
# Copy all schemas/data from any PostgreSQL source (e.g. Neon) into the target
# DATABASE_URL from .env (DigitalOcean). Does not read Neon from the repo — you
# must pass SOURCE_DATABASE_URL from Neon’s dashboard / connection string.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "Usage: SOURCE_DATABASE_URL='postgresql://...' $0" >&2
  echo "Optional: TARGET_DATABASE_URL=... to override .env; CLEAN_RESTORE=1 to drop existing objects first." >&2
  exit 1
fi

target_from_env_file() {
  local line
  line="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 || true)"
  line="${line#DATABASE_URL=}"
  # trim
  echo "$(echo "$line" | tr -d '\r')"
}

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-$(target_from_env_file)}"
if [[ -z "$TARGET_DATABASE_URL" || "$TARGET_DATABASE_URL" == *"REPLACE_"* ]]; then
  echo "Could not read a real DATABASE_URL from $ENV_FILE." >&2
  exit 1
fi

if [[ "$TARGET_DATABASE_URL" == *"ondigitalocean.com"* ]] || [[ "$SOURCE_DATABASE_URL" == *"ondigitalocean.com"* ]]; then
  if [[ -r /etc/ssl/digitalocean/ca-certificate.crt ]]; then
    export PGSSLROOTCERT="${PGSSLROOTCERT:-/etc/ssl/digitalocean/ca-certificate.crt}"
  fi
fi

TMP="$(mktemp -t pipe-leadfinder-pgdump.XXXXXX.dump)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

echo "Dumping from source (Neon or other Postgres)…"
pg_dump "$SOURCE_DATABASE_URL" -Fc -f "$TMP" -v

RESTORE_ARGS=(--no-owner --no-acl --verbose)
if [[ "${CLEAN_RESTORE:-}" == "1" ]]; then
  RESTORE_ARGS+=(--clean --if-exists)
fi

echo "Restoring into target (DigitalOcean from .env unless TARGET_DATABASE_URL was set)…"
pg_restore -d "$TARGET_DATABASE_URL" "${RESTORE_ARGS[@]}" "$TMP"

echo "Done. Verify in psql or Prisma Studio; run prisma migrate if you rely on migrations."
