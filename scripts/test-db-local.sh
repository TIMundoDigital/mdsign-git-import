#!/usr/bin/env bash
# Suítes de banco (RLS/permissões e regras comerciais) num Postgres LOCAL do Supabase, com as
# migrações do repositório. Usado pela CI (job "banco"); no Mac exige Docker.
# Nada toca o banco hospedado: para testar uma migração nova contra a homologação, use
# scripts/test-rls.sh.
#
# Uso: bash scripts/test-db-local.sh            (sobe o banco local e roda tudo)
#      SKIP_START=1 bash scripts/test-db-local.sh  (banco local já está no ar)
set -euo pipefail
cd "$(dirname "$0")/.."

CLI="npx -y supabase@3.2.0"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
run_sql() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

if [[ -z "${SKIP_START:-}" ]]; then
  echo "== Banco local com as migrações do repositório"
  $CLI db start
  $CLI db reset --no-seed
fi
run_sql -t -c "select count(*) || ' migrações aplicadas' from supabase_migrations.schema_migrations"

echo "== RLS e permissões (transação desfeita no fim)"
{ echo "begin;"; cat supabase/tests/rls.sql; echo "rollback;"; } | run_sql -f - | tee "$out/rls.txt"
grep -q "todos os testes de RLS e permissões passaram" "$out/rls.txt"

echo "== Regras comerciais"
# Na homologação, a matriz de lançamento foi publicada pelo Super Admin (não por migração).
# Aqui o banco é descartável: publica do mesmo jeito que admin_publish_plan_version, sem auditoria.
run_sql -c "update public.plan_versions set status = 'retired' where status = 'published';
            update public.plan_versions set status = 'published', published_at = now()
              where id = 'lancamento_2026_11';"
run_sql -f supabase/tests/comercial.sql | tee "$out/comercial.txt"
if grep -q "FALHOU" "$out/comercial.txt"; then
  echo "Regra comercial falhou (ver acima)."
  exit 1
fi
passed=$(grep -c "PASSOU" "$out/comercial.txt" || true)
echo "Regras comerciais: $passed casos passaram."
[[ "$passed" -gt 0 ]]
