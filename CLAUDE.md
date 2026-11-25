# MDSign: contexto para o Claude

> Arquivo de contexto do projeto, mantido no repositório. Não contém senhas, chaves nem tokens,
> e nunca deve conter. Atualize-o quando uma decisão ou um ambiente mudar.

## 1. Como trabalhar neste projeto

- Responda **sempre em português do Brasil**, inclusive mensagens curtas de progresso.
- Explique em linguagem de negócio, sem jargão. Quando houver escolha, recomende uma opção.
- **Antes de cada `git push`, peça o "sim" da responsável pelo projeto (Roberta Cardoso).**
  Também peça aprovação antes de migrações, mudanças de autenticação, infraestrutura ou RLS,
  e de qualquer envio real ao SignDoc ou escrita em banco.
- Comece cada sessão conferindo o estado: `git status` e `git log -5`.

## 2. O projeto

- **MDSign**: plataforma de assinatura digital (SaaS) da MDTech que usa o motor **SignDoc**
  (Lacuna Signer) por API.
- O projeto foi migrado da conta pessoal para a conta da MDTech em 05/11/2026.

### Ambientes atuais

| Item | Onde |
|---|---|
| Repositório | GitHub `TIMundoDigital/mdsign-git-import`, branch `main` (é o que o Lovable sincroniza). `TIMundoDigital/roberta-MDSIGN` é a cópia da migração, sem ligação com o Lovable |
| Front | Lovable, projeto `33353745-27fd-4380-8a2b-929ec05aac8b`, publicado em https://mdsign-new.lovable.app (push na `main` sincroniza; depois, **Publish → Update** no Lovable). O endereço antigo `mdsign.lovable.app` não é mais nosso e não deve constar em `ALLOWED_ORIGINS` nem nas URLs do Auth |
| Supabase de **homologação** | projeto `vrksxqbopteeyeovdwpu` ("MDSign", us-east-1), transferido para a organização da MDTech em 11/11/2026 |
| Supabase de **produção** | a criar em **sa-east-1** (São Paulo), ver `docs/migracao-sa-east-1.md` |
| Motor | https://sign.signdocmd.com.br (SignDoc 3.3.1 desde 22/11/2026; antes 2.9), aplicação "MDSign" |

- O projeto `vrksxqbopteeyeovdwpu` é o mesmo de antes da migração: em vez de copiar os dados, ele
  foi transferido da conta pessoal para a organização da MDTech. Os valores padrão do código
  (`src/lib/supabase.ts`, `src/config/site.ts`, `src/lib/security-headers.ts`) e os scripts
  apontam para ele. Um build com `VITE_ENVIRONMENT=production` exige os endereços de produção e
  recusa os da homologação (`src/config/build-check.ts`).
- Em 18/11/2026: 70 migrações no repositório, 28 funções e os 13 segredos de sempre.
- Publicação, conferência e recuperação: **`docs/runbook.md`**. Auditoria de 17/11/2026:
  `AUDITORIA-MDSIGN.md` (fora do Git).
- A `20261016180000_rotinas_endereco_no_cofre.sql` faz as rotinas lerem o endereço das funções do
  Vault (`mdsign_functions_url`). **Não editar migrações já aplicadas.**
- O projeto `ymseserdiwecgaueycwi` (criado em 05/11/2026 para ser a homologação) nunca teve
  usuários e foi **excluído em 11/11/2026**, junto com o ramo `homologacao-supabase`, que apontava
  para ele.

### Tecnologia

- TanStack Start + React 19 + Vite + Tailwind/shadcn. O gerenciador de pacotes é o **bun**
  (`bun.lock`); se não estiver instalado, use `npx -y bun@1 install --frozen-lockfile`.
- Supabase: Postgres com RLS e Edge Functions em Deno (`supabase/functions`, código comum em
  `_shared/`).
- Lacuna Signer API e LacunaSignerWidget 0.8.0 (quadro de assinatura embutido).
- E-mail pelo **Resend**. WhatsApp pelo BotConversa. Cobrança pelo **Asaas, só Sandbox**.
- Idiomas: `src/i18n/app/{pt,en,es}.ts` (app) e `src/i18n/messages/*` (site).

### Comandos de verificação

- `npx tsc --noEmit -p .` e `npx eslint --fix <arquivos>`. Se `src/test/consent.test.ts` mudar,
  restaure.
- `npx vitest run` (104 testes passando em 18/11/2026).
- `bash scripts/test-rls.sh [migrações]`: suíte de RLS com rollback (`supabase/tests/rls.sql`),
  contra a homologação (pede o "sim", porque escreve e desfaz).
- `supabase/tests/comercial.sql`: regras comerciais, 23/23, numa transação desfeita no fim.
- `bash scripts/test-db-local.sh`: as duas suítes num banco local descartável (CI; no Mac exige
  Docker).
- **Testes e checagens Deno só numa cópia fora do repositório**, nunca na raiz (quebra o
  `node_modules`; nesse caso, `rm -rf node_modules && npx -y bun@1 install --frozen-lockfile`):
  `cp -R supabase /tmp/x && cd /tmp/x && SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=teste SUPABASE_ANON_KEY=teste SIGNDOC_API_KEY=teste SIGNDOC_WEBHOOK_TOKEN=token-de-teste npx -y deno@2.9.6 test -A tests/`
  (66 testes em 18/11/2026; banco, login, SignDoc, Asaas, Resend e Storage simulados em
  `supabase/tests/fake_backend.ts`).
- CI do GitHub (`.github/workflows/ci.yml`): etapas verificar, servidor e banco. Resultado sem
  login pela API pública (limite de 60 consultas por hora).
- `npx vite build`.
- Servidor local: `.claude/launch.json` → "mdsign" na porta 5188.

## 3. Regras permanentes (não negociar)

1. **Nunca usar créditos nem o agente do Lovable.** Atualizar só por `git push`.
2. **Não reescrever o histórico já publicado**: nada de force push nem rebase, amend ou squash de
   commits já enviados. Rebase de commits locais ainda não enviados é permitido.
3. **Segredos nunca no chat, no código nem no Lovable.** Use os scripts com `read -s`:
   `scripts/resend-key.sh`, `scripts/resend-webhook-secret.sh`, `scripts/signdoc-key.sh`,
   `scripts/botconversa-key.sh`, `scripts/whatsapp-webhook-secret.sh` e `scripts/cron-secret.sh`
   (gera a senha das rotinas e grava o mesmo valor no Vault e em `CRON_SECRET`).
4. O Claude **não digita senhas, CPFs reais nem tokens** e não cria contas.
5. **Nenhum envio real ao SignDoc nem escrita em banco sem o "sim" da responsável.**
6. **Asaas: só Sandbox.** Nunca produção nem cobrança real sem aprovação expressa.
7. **Dados pessoais e prints reais nunca entram no repositório.**
8. **Sem migrações destrutivas.** Só acréscimos.
9. **Não modificar o motor SignDoc.**
10. **Deploy de banco e funções** (`supabase db push`, `supabase functions deploy`):
    - o Claude pode aplicar pelo CLI do Mac (que exige `--yes`), **só depois do "sim"** e só no
      projeto de homologação; a responsável também pode rodar o comando pronto no Terminal, por
      exemplo `for f in A B C; do npx supabase functions deploy $f --use-api || break; done`;
    - antes de aplicar migração: rodar a suíte de RLS com ela (desfeita no fim) e
      `npx supabase db push --remote --dry-run`, que deve listar só a migração nova;
    - para saber quais funções publicar, siga os imports de `_shared/` (diretos e indiretos);
    - depois, conferir com `npx supabase migration list --remote`,
      `npx supabase functions list -o json` e consultas só de leitura (`--read-only`);
    - **ordem segura:** migração → funções → `git fetch` (rebase se houver commit novo do Lovable,
      depois testes) → push (com o "sim") → Publish/Update no Lovable.

## 4. Planos comerciais (matriz `lancamento_2026_11`, publicada)

Não há clientes reais: todas as contas são de teste.

| Plano | Preço | Limites |
|---|---|---|
| **Cedro** | grátis | 5 documentos por pessoa, 1 usuário, 1 aprovador, disponibilidade de 6 meses |
| **Jacarandá** | R$ 39,90 | 50 documentos/mês, 1 usuário |
| **Ipê** | R$ 99,97 | 4 usuários, ilimitado |
| **Mogno** | sob contrato | — |

- Angico e Aroeira têm `is_public=false` e ficam só pelo histórico.
- Formulários, WhatsApp e Gestão avançada: só Ipê e Mogno. Vários aprovadores: do Jacarandá em
  diante (`approval_multi`).
- Relatórios: Ipê tem período, situação, pessoa e CSV; Mogno tem o mesmo, mais origem, modelo,
  departamento, grupo e pasta, com exportação em Excel/PDF (`reports_advanced`).
- Matriz versionada: tabelas `plan_versions`, `plan_version_prices`,
  `plan_version_entitlements` e `plan_version_features`; funções `feature_mode` e
  `feature_enabled`; gerenciada no Super Admin, em "Planos & Funcionalidades".
- Pendente de decisão: "Ipê ilimitado" com uso justo, teto ou mantido como está.

## 5. Regras de fluxo já implementadas

- **Recusa:** `documents.refusal_kind` é `return` (devolução para correção) ou `reject`
  (rejeição definitiva). Recusa feita na tela do SignDoc conta como devolução.
- A devolução aceita nova versão: `document_versions` guarda o sha256 de cada uma, e o motor
  reinicia o fluxo.
- `document_events` e `document_versions` são **imutáveis**: gatilhos bloqueiam alteração e
  exclusão, inclusive pelo servidor.
- **Ligação com o motor** (`_shared/engine-link.ts`): participante ligado à ação do SignDoc pelo
  e-mail, pelo CPF ou pela posição na etapa; a sincronização religa quem ficou sem vínculo; o
  alerta `documents_incomplete` aponta o que não fechar.
- **Filas** (notificações, webhooks de saída, eventos do motor) com reserva
  (`claim_*`, `locked_until`): duas execuções ao mesmo tempo não enviam em dobro.
- **Identificador de envio** obrigatório nas telas (envio, modelo, Só eu assino, formulário
  público): repetir a chamada devolve o mesmo documento.
- **Plano e usuários:** o limite vale no convite, no aceite e na reativação; troca voluntária para
  plano menor é recusada se não couber; em plano menor forçado, os excedentes são suspensos e
  voltam sozinhos quando o plano comporta (gatilho em `subscriptions`).
- **Cobrança (Asaas):** estorno e chargeback suspendem; conta suspensa recebe aviso por e-mail e
  volta ao Cedro **15 dias depois do aviso** (`billing_grace.downgrade_days`); sem aviso enviado,
  não muda.
- **Encerramento de conta:** sem download obrigatório; confirmação de ciência registrada na
  auditoria; no 60º dia a exclusão cobre também cópias, fluxos salvos, anexos, pastas e unidades.
- **Verificação em duas etapas:** quem ativou só acessa os dados (também pela API) com a sessão
  confirmada (`mfa_ok`).
- **Webhooks de saída:** só para endereços públicos (`_shared/ssrf.ts`).
- **Alertas da plataforma** também por e-mail aos Super Admins, uma vez por abertura.
- **Etapas** (`cleanParticipants` em `_shared/participants.ts`): sem ordem, aprovadores na
  etapa 1 e demais na etapa 2; com ordem, cada pessoa ou grupo de quórum é uma etapa.
- **Posições no PDF:** **uma assinatura por pessoa** (o SignDoc recusa mais de uma). Rubrica e
  carimbo podem repetir. Validação na tela e no servidor (`assertOneSignature` em `_shared/pdf.ts`).
- **E-mail:** `notifications.opened_at`; o webhook `resend-webhook` verifica a assinatura Svix com
  `RESEND_WEBHOOK_SECRET`; eventos `notification.sent` (com `data.channel`), `notification.delivered`,
  `notification.failed`, `participant.email_opened`, `participant.viewed`; os erros `resend_403` e
  `resend_422` encerram na hora com o motivo `test_sender` ou `provider_rejected`.
- **Autenticação do signatário:** `SIGNDOC_AUTH_METHODS=sms,selfie,certificate` (18/11/2026).
  SMS e selfie homologados com envio real, em todos os planos; WhatsApp recusado pelo motor
  ("disabled"), aguardando a Lacuna. Certificado (`qualified`, só certificado, sem assinatura
  eletrônica) depende também de `certificate_signature` funcional na matriz (Jacarandá em diante).
  Conferência dos métodos no Super Admin (`admin-engine-check`). Ver `docs/niveis-de-autenticacao.md`.
- **Cancelamento:** justificativa obrigatória (5+ caracteres) na tela e no servidor; vai ao
  SignDoc e aparece na linha do tempo (`statusUpdateReason`). Pela API continua opcional.
- **Estrangeiros sem CPF:** código pronto (`SIGNDOC_IDENTIFIER_OPTIONAL=true` mais
  `CountryIdentifierMode=Nullable` no SignDoc). Só tratar na versão final.

## 6. Entregas até 27/10/2026 (último commit antes da migração: `dc124c0`)

- Localização e câmera liberadas só para `https://sign.signdocmd.com.br`
  (`src/lib/security-headers.ts`) e quadro com `allow="geolocation; camera"`.
- Botão "Versão para impressão" em destaque.
- **Baixar em lote**: função `documents-zip`, até 30 documentos e 100 MB, com LEIA-ME.txt.
- **Fluxos salvos**: tabela `saved_flows` e componente `saved-flows.tsx`.
- **Enviar cópia** de documento concluído: função `document-share`, tabela `document_shares`,
  página `/d/$token`, até 10 e-mails e link de 7 dias.
- Chave "Assinar em ordem" no passo 2 do envio.

## 6b. Entregas de 11 a 18/11/2026

- Migração encerrada; site em `mdsign-new.lovable.app`; políticas aprovadas pelo Jurídico
  publicadas (Termos 3.0, Privacidade 1.0, Cedro 1.0, vigentes em 17/11/2026, aceite `2026-11`).
- Itens da auditoria: D-01, D-12, P0-5 a P0-9, P0-13, P1-1 a P1-4, P1-6 a P1-9, P1-11, P1-12 e
  correções menores (ver `git log`). ZIP em lote com escolha de PDF assinado ou para impressão.

## 7. Próximos passos

1. **E-mail pelo Resend com o domínio `mdsign.app`** (DNS na HostGator), verificado em
   18/11/2026, região São Paulo, rastreio de abertura em `links.mdsign.app` (cliques desligados).
   - Chave nova "MDSign" (só envio, só `mdsign.app`) e remetente `MDSign <no-reply@mdsign.app>`
     gravados por `scripts/resend-key.sh`. A caixa `no-reply@mdsign.app` fica no **Titan**: não
     criar o MX de recebimento do Resend nem mexer nos registros do Titan.
   - Testado em 18/11/2026: e-mail próprio da Cardosos religado; lembrete enviado, entregue e
     aberto. O Microsoft 365 mandou a primeira mensagem para o Lixo Eletrônico (domínio novo).
     Chaves antigas apagadas.
   - E-mails de login (Auth) pelo SMTP do Resend (`smtp.resend.com:465`, usuário `resend`, chave
     própria "MDSign Login"), configurado no painel do Supabase; modelos em português de
     `supabase/templates` publicados com `npx supabase config push` (18/11/2026). O SMTP não está
     no `config.toml`, de propósito: o push não mexe nele.
   - Uma única chave no Resend, "MDSign Login" (só envio, só `mdsign.app`), usada pelo SMTP do
     login e pelas funções (`RESEND_API_KEY`). Se revogar, gravar a nova nos dois lugares.
   - O domínio `mail.mundodigitaltech.com.br`, que ficou pela metade no Resend, não é mais usado.
2. **Certificado digital: homologado em 23/11/2026** (A3, dentro do quadro do MDSign, depois da
   atualização do SignDoc para a 3.3.1). O site anuncia o certificado do Jacarandá em diante.
   Próximo: "Assinar todos" (plano: lote público da 3.3 via `notify-pending` para eletrônica e
   aprovação; lote com certificado no MDSign pela documentação da Lacuna), aguardando aprovação.
3. **P0-12, roteiros de homologação** com envios reais (a responsável pediu para deixar para
   depois).
4. **Outras pendências:**
   - indicação do DPO, prazos de retenção por categoria e mecanismo de transferência
     internacional (pontos em aberto nas notas do Jurídico); avisar o Jurídico de que a seção 8
     dos Termos foi publicada com a matriz vigente;
   - segundo responsável com acesso e cofre corporativo de senhas (`docs/runbook.md`);
   - testar SMS, WhatsApp e selfie antes de liberar em `SIGNDOC_AUTH_METHODS`;
   - restrição de acesso por pasta (ainda não pedida);
   - GTM (`VITE_GTM_ID`), domínio de produção (`VITE_SITE_URL` e `ALLOWED_ORIGINS`) e banco em
     sa-east-1: só na ida para produção;
   - Asaas produção: só com autorização expressa (checklist em `docs/asaas-producao.md`);
   - desativar a aplicação antiga "MDSign Backend" no SignDoc e confirmar a revogação da chave
     antiga.

## 8. Segredos das funções (só os nomes)

`ALLOWED_ORIGINS`, `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `BOTCONVERSA_API_KEY`,
`CRON_SECRET`, `EMAIL_FROM`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SIGNDOC_ADMIN_API_KEY`,
`SIGNDOC_API_KEY`, `SIGNDOC_WEBHOOK_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`.

Para conferir sem expor os valores: `npx supabase secrets list` (a saída mostra só hashes).
