#!/usr/bin/env bash
# Gera a senha das rotinas agendadas e grava o MESMO valor em dois lugares:
#   1. Vault do banco (`mdsign_cron_secret`), lido pelas rotinas pg_cron;
#   2. segredo das funções (`CRON_SECRET`), conferido por reminders-run e webhooks-run.
# A senha é gerada aqui e nunca aparece na tela, no repositório nem no histórico do terminal.
# Requer o projeto ligado (npx supabase link) e Supabase CLI 2.79 ou mais nova (db query).
# Uso: bash scripts/cron-secret.sh
set -euo pipefail
cd "$(dirname "$0")/.."

REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
echo "Projeto ligado: ${REF:-desconhecido}"
read -r -p "Gravar uma senha nova das rotinas neste projeto? (s/N) " OK
if [[ "$OK" != "s" && "$OK" != "S" ]]; then echo "Nada foi gravado."; exit 0; fi

SECRET="$(openssl rand -hex 32)"

TMP_DIR="$(mktemp -d)"
chmod 700 "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. Vault: cria ou atualiza o segredo.
cat > "$TMP_DIR/vault.sql" <<SQL
do \$\$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'mdsign_cron_secret';
  if sid is null then
    perform vault.create_secret('${SECRET}', 'mdsign_cron_secret', 'Senha das rotinas agendadas');
  else
    perform vault.update_secret(sid, '${SECRET}');
  end if;
end \$\$;
SQL
npx supabase db query --linked -f "$TMP_DIR/vault.sql" >/dev/null

# 2. Segredo das funções.
printf 'CRON_SECRET=%s\n' "$SECRET" > "$TMP_DIR/cron.env"
npx supabase secrets set --env-file "$TMP_DIR/cron.env" >/dev/null

unset SECRET
echo "Senha das rotinas gravada no Vault e em CRON_SECRET (mesmo valor)."
