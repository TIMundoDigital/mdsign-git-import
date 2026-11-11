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
| Motor | https://sign.signdocmd.com.br (SignDoc 2.9), aplicação "MDSign" |

- O projeto `vrksxqbopteeyeovdwpu` é o mesmo de antes da migração: em vez de copiar os dados, ele
  foi transferido da conta pessoal para a organização da MDTech. Os valores padrão do código
  (`src/lib/supabase.ts`, `src/config/site.ts`, `src/lib/security-headers.ts`) e os scripts
  apontam para ele. Conferido em 11/11/2026: 56 migrações aplicadas, 27 funções ativas e os 13
  segredos cadastrados.
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
- `npx vitest run` (98 testes passando em 27/10/2026).
- `bash scripts/test-rls.sh [migrações]`: suíte de RLS com rollback (`supabase/tests/rls.sql`).
- `supabase/tests/comercial.sql`: regras comerciais, 23/23, numa transação desfeita no fim.
- **Checagens Deno só numa cópia fora do repositório** (`npx -y deno@2.9.6 check ...`), nunca na
  raiz. Rodar na raiz quebra o `node_modules`; nesse caso,
  `rm -rf node_modules && npx -y bun@1 install --frozen-lockfile`.
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
    - padrão: a responsável roda no Terminal do Mac; o Claude entrega o comando pronto, por exemplo
      `for f in A B C; do npx supabase functions deploy $f --use-api || break; done`;
    - em sessões na nuvem, o Claude pode aplicar pelo conector do Supabase, **só depois do "sim"**
      e só no projeto de homologação;
    - para saber quais funções publicar, faça um grep dos imports de `_shared/`;
    - depois, conferir com `npx supabase migration list --linked`,
      `npx supabase functions list -o json` e consultas só de leitura;
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
- `document_events` e `document_versions` são **imutáveis** (trigger bloqueia update).
- **Etapas** (`cleanParticipants` em `_shared/participants.ts`): sem ordem, aprovadores na
  etapa 1 e demais na etapa 2; com ordem, cada pessoa ou grupo de quórum é uma etapa.
- **Posições no PDF:** **uma assinatura por pessoa** (o SignDoc recusa mais de uma). Rubrica e
  carimbo podem repetir. Validação na tela e no servidor (`assertOneSignature` em `_shared/pdf.ts`).
- **E-mail:** `notifications.opened_at`; o webhook `resend-webhook` verifica a assinatura Svix com
  `RESEND_WEBHOOK_SECRET`; eventos `notification.sent.<canal>`, `notification.delivered`,
  `notification.failed`, `participant.email_opened`, `participant.viewed`; os erros `resend_403` e
  `resend_422` encerram na hora com o motivo `test_sender` ou `provider_rejected`.
- **Assinatura com certificado:** no nível normal, o MDSign manda `allowElectronicSignature: true`
  e o SignDoc oferece o certificado; o nível "qualified" só aparece se o segredo
  `SIGNDOC_AUTH_METHODS` contiver `certificate` (esse segredo não existe hoje).
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

## 7. Próximos passos

1. **Domínio de e-mail no Resend: `mail.mundodigitaltech.com.br`** (DNS na HostGator).
   - CNAMEs `rsend.mail` e `send.mail` já estão OK.
   - Faltam os TXT do DKIM (`resend._domainkey.mail.mundodigitaltech.com.br.`, valor `p=…` do
     Resend) e do DMARC (`_dmarc.mundodigitaltech.com.br.`, `v=DMARC1; p=none;`). No cPanel,
     clicar em "Save All Records". Não mexer nos registros `octa-mails` nem `ock*._domainkey`.
   - Depois de "Verified": trocar a chave do Resend, definir o remetente com
     `bash scripts/resend-key.sh` (`MDSign <nao-responda@mail.mundodigitaltech.com.br>`) e testar
     um envio, conferindo "entregue/aberto" na linha do tempo.
2. **Certificado digital: "Invalid license"** ao assinar com A3 dentro do quadro embutido.
   Hipótese: a licença do Web PKI cobre só `sign.signdocmd.com.br`. Próximo teste: assinar o mesmo
   documento direto no SignDoc. Se funcionar, pedir à Lacuna a inclusão do domínio do MDSign ou
   abrir a assinatura com certificado em nova aba; se falhar, abrir chamado na Lacuna. Até lá, o
   site diz "ICP-Brasil em breve".
3. **ZIP em lote:** escolher o tipo de arquivo (PDF assinado ou versão para impressão). A função
   `documents-zip` já aceita `version: "printable"`; falta a escolha na tela
   (`src/routes/app/_shell/documents/index.tsx`, função `downloadSelected`).
4. **Outras pendências:**
   - revisão jurídica dos Termos (minutas com `LEGAL_DRAFT` em `src/content/legal.ts`) e
     indicação do DPO;
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
