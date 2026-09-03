#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Migración de datos: Render PostgreSQL → Supabase (cero pérdida)
#
# Uso:
#   RENDER_DATABASE_URL="postgresql://...render.com/db" \
#   SUPABASE_DIRECT_URL="postgresql://postgres:<pass>@db.<ref>.supabase.co:5432/postgres" \
#   ./migrate_to_supabase.sh
#
# Notas:
# - El restore usa la conexión DIRECTA de Supabase (puerto 5432), NO el pooler
#   6543 (transaction mode no soporta pg_restore).
# - Crea el dump en ./backup/ con marca de tiempo (puedes repetirlo sin riesgo).
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

: "${RENDER_DATABASE_URL:?Define RENDER_DATABASE_URL (origen, Render)}"
: "${SUPABASE_DIRECT_URL:?Define SUPABASE_DIRECT_URL (destino, Supabase puerto 5432)}"

STAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="backup/demarq_render_${STAMP}.dump"
mkdir -p backup

echo "1/4 → Exportando BD de Render a ${DUMP_FILE}..."
pg_dump "$RENDER_DATABASE_URL" \
  --no-owner --no-privileges \
  --format=custom \
  --file="$DUMP_FILE"
echo "    Dump creado: $(du -h "$DUMP_FILE" | cut -f1)"

echo "2/4 → Verificando integridad del dump..."
pg_restore --list "$DUMP_FILE" > /dev/null && echo "    OK"

echo "3/4 → Restaurando en Supabase..."
pg_restore --dbname="$SUPABASE_DIRECT_URL" \
  --no-owner --no-privileges \
  --clean --if-exists \
  --jobs=4 \
  "$DUMP_FILE"
echo "    Restore completado."

echo "4/4 → Verificación post-migración (conteo de filas clave):"
for t in projects contractors contractor_project_budgets report_entries weekly_reports office_payments audit_logs; do
  SRC=$(psql "$RENDER_DATABASE_URL" -tAc "SELECT COUNT(*) FROM $t" 2>/dev/null || echo 'N/A')
  DST=$(psql "$SUPABASE_DIRECT_URL" -tAc "SELECT COUNT(*) FROM $t" 2>/dev/null || echo 'N/A')
  if [ "$SRC" = "$DST" ]; then MARK="✅"; else MARK="❌"; fi
  echo "    ${MARK} ${t}: Render=${SRC} Supabase=${DST}"
done

echo ""
echo "Migración terminada. Siguientes pasos:"
echo "  1. DATABASE_URL='$SUPABASE_DIRECT_URL' node backend/seed.js        # asegura tabla user_sessions"
echo "  2. DATABASE_URL='$SUPABASE_DIRECT_URL' node check_financial_state.js # valida consistencia financiera"
echo "  3. node fix_current_week_vps.js    # (simulación) si la semana en curso quedó con datos viejos"
echo "  4. Configura DATABASE_URL (pooler 6543) y SESSION_SECRET en Vercel y despliega."
