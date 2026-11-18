# Plano de migração do banco para São Paulo (sa-east-1)

Decisão de 16/10/2026: ao colocar o MDSign em produção, o banco sai de `us-east-1` (EUA) e vai
para `sa-east-1` (São Paulo), resolvendo o risco P0-01 da auditoria (transferência internacional
de dados pessoais). O projeto atual (`vrksxqbopteeyeovdwpu`) passa a ser o ambiente de
**homologação**.

> Este plano **não foi executado**. Cada etapa marcada com ⚠️ precisa de aprovação antes.
> Inventário revisado em 18/11/2026. Publicação, conferência e recuperação: `docs/runbook.md`.

## 1. O que existe hoje (inventário)

| Item | Onde está | O que fazer |
|---|---|---|
| Esquema do banco | `supabase/migrations/*.sql` (versionado) | Aplicar no projeto novo com `supabase db push` |
| Dados | Postgres do projeto atual (tabelas de `public`, mais `auth`, `storage` e `vault`; contar no dia) | Copiar com `pg_dump`/`pg_restore` na janela de migração |
| Usuários e senhas, MFA | Esquema `auth` (inclui `mfa_factors`) | Vêm no dump do `auth`; senhas e fatores TOTP continuam valendo |
| Arquivos | Buckets privados `templates`, `bulk-sources` e `attachments` | `bash scripts/copy-storage.sh` (simula), depois com `--executar` |
| Funções do servidor | `supabase/functions` (27 funções, todas com `verify_jwt = false` no `config.toml`) | `supabase functions deploy <nome> --use-api` no projeto novo |
| Segredos das funções | ALLOWED_ORIGINS, ASAAS_API_KEY, ASAAS_ENV, ASAAS_WEBHOOK_TOKEN, BOTCONVERSA_API_KEY, CRON_SECRET, EMAIL_FROM, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, SIGNDOC_ADMIN_API_KEY, SIGNDOC_API_KEY, SIGNDOC_WEBHOOK_TOKEN, WHATSAPP_WEBHOOK_SECRET (SIGNDOC_AUTH_METHODS só se for liberar métodos além do e-mail; SITE_URL recomendado) | Gravar no projeto novo pelos scripts `read -s` (nunca no chat) |
| Segredos no Vault | `mdsign_cron_secret` e `mdsign_functions_url` (usados pelas rotinas) | Recriar no Vault do projeto novo, com o endereço do projeto novo |
| Rotinas agendadas | `mdsign-reminders-run` (de hora em hora), `mdsign-webhooks-run` (a cada minuto), `mdsign-alerts-refresh` (de hora em hora, só banco), `mdsign-cron-cleanup` (diária) | Criadas pelas migrações; leem o endereço do Vault (seção 2) |
| Webhook do SignDoc | Cadastrado no motor apontando para `…/functions/v1/signdoc-webhook` | ⚠️ Repontar para o projeto novo |
| Webhook do Resend | Cadastrado no Resend apontando para `…/functions/v1/resend-webhook` | Repontar e gravar o novo segredo (`scripts/resend-webhook-secret.sh`) |
| WhatsApp (BotConversa) | Fluxo de descadastro chama `…/functions/v1/whatsapp-webhook` | Repontar e gravar o novo segredo (`scripts/whatsapp-webhook-secret.sh`) |
| Webhook do Asaas (Sandbox) | Cadastrado no Asaas apontando para `…/functions/v1/asaas-webhook` | Repontar (Super Admin → Cobrança → Configurar webhook) |
| Front (Lovable) | `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (com valores padrão no código) | Trocar as variáveis no Lovable e os valores padrão no código |
| Configuração do Auth | URLs de redirecionamento, confirmação de e-mail, modelos de e-mail (`supabase/templates`, ligados no `config.toml`), MFA TOTP, SMTP próprio (Resend) | Reproduzir no painel do projeto novo |

## 2. Correções antes de migrar (no código, sem efeito na produção atual)

1. ✅ **Rotinas agendadas com endereço fixo** (feito em 16/10/2026, migração
   `20261016180000_rotinas_endereco_no_cofre.sql`). As rotinas leem a URL base do Vault
   (`mdsign_functions_url`, ex.: `https://<projeto>.supabase.co/functions/v1`). No projeto novo,
   gravar esse segredo e o `mdsign_cron_secret` antes de ligar as rotinas; sem o segredo, a
   chamada não acontece.
2. ✅ **Valores padrão do projeto no front** (feito em 18/11/2026, `src/config/build-check.ts`):
   com `VITE_ENVIRONMENT=production`, o build exige `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL` e `VITE_LEAD_ENDPOINT`, e recusa endereços
   da homologação. Sem a variável, o build segue com os padrões (homologação).
3. ✅ **Script de cópia do Storage** (feito em 18/11/2026, `scripts/copy-storage.sh`): pede as
   chaves sem mostrar na tela, lista e compara os três buckets; com `--executar`, copia o que
   falta e confere quantidade e tamanho de cada arquivo.

## 3. Ensaio (num projeto de teste em São Paulo) ⚠️ gera custo

1. Criar o projeto `mdsign-ensaio` em `sa-east-1`.
2. `supabase link` no projeto de ensaio → `supabase db push` (esquema).
3. Rodar `bash scripts/test-rls.sh` contra ele (bateria completa de segurança).
4. Dump do projeto atual e restauração no ensaio; cópia do Storage (`scripts/copy-storage.sh`).
5. Publicar as funções, gravar segredos de teste, apontar um front local para o ensaio.
6. Executar a matriz de testes da auditoria (T-01 a T-25) no ensaio.
7. Medir a duração de cada passo (define a janela da migração real) e apagar o projeto de ensaio.

## 4. Migração real (janela curta, fora do horário comercial) ⚠️

1. Avisar os clientes da janela (ex.: 30 a 60 min).
2. Criar o projeto `mdsign` em `sa-east-1`; aplicar o esquema; gravar segredos e Vault.
3. **Congelar escrita**: Lovable em página de manutenção; desligar as rotinas no projeto antigo.
4. Dump final do projeto antigo → restauração no novo; cópia do Storage (`scripts/copy-storage.sh --executar`).
5. Conferência: contagem de linhas por tabela e de arquivos por bucket iguais nos dois projetos.
6. Publicar as funções no novo; recriar as rotinas (seção 2.1) e ligá-las.
7. Repontar os webhooks do SignDoc, do Asaas, do Resend e do BotConversa para o projeto novo.
8. Trocar as variáveis do Lovable (inclusive `VITE_ENVIRONMENT=production`) e publicar.
9. Testes de fumaça: login com MFA, Só eu assino, envio, webhook do motor chegando, download,
   Super Admin.
10. Reabrir. Manter o projeto antigo só leitura por 7 dias; depois vira homologação (dados de teste).

## 5. Critérios para voltar atrás (rollback)

- Contagens divergentes que não se expliquem.
- Falha nos testes de fumaça de login, criação de documento ou webhook do motor.
- Ação: voltar as variáveis do Lovable para o projeto antigo, religar as rotinas dele e repontar
  os webhooks. Como a escrita estava congelada, nada se perde.

## 6. Depois da migração

- Atualizar a Política de Privacidade (seção 11) com o local de armazenamento no Brasil.
- Atualizar `docs/asaas-producao.md` e a memória do projeto com o novo `project ref`.
- Confirmar com a Lacuna onde o SignDoc guarda os documentos (fora do escopo desta migração).
