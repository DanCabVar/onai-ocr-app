#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/../prisma/migrations/manual_rls_and_views.sql"

echo "Aplicando RLS y vistas filtradas..."
PGPASSWORD=OnaiOcr2026!Moti psql -h 172.23.0.4 -U postgres -d onai_ocr -f "$SQL_FILE"
echo "Done."
