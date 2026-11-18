#!/usr/bin/env bash
# Cópia do Storage entre projetos (migração para sa-east-1). Pede os endereços e as chaves sem
# mostrar na tela; as chaves só existem no ambiente deste processo. Por padrão só simula.
# Uso: bash scripts/copy-storage.sh            (simula: lista e compara)
#      bash scripts/copy-storage.sh --executar (copia o que falta e confere)
set -euo pipefail
cd "$(dirname "$0")/.."

read -r -p "URL do projeto de ORIGEM (https://<ref>.supabase.co): " ORIGEM_URL
read -r -s -p "Chave secreta (service_role) da ORIGEM: " ORIGEM_CHAVE
echo
read -r -p "URL do projeto de DESTINO (https://<ref>.supabase.co): " DESTINO_URL
read -r -s -p "Chave secreta (service_role) do DESTINO: " DESTINO_CHAVE
echo
if [ "$ORIGEM_URL" = "$DESTINO_URL" ]; then echo "Origem e destino iguais. Nada foi feito."; exit 1; fi

ORIGEM_URL="$ORIGEM_URL" ORIGEM_CHAVE="$ORIGEM_CHAVE" DESTINO_URL="$DESTINO_URL" \
  DESTINO_CHAVE="$DESTINO_CHAVE" node scripts/copy-storage.mjs "$@"
