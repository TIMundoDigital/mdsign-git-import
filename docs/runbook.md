# Runbook do MDSign: publicação, conferência e recuperação

Versão de 17/11/2026 (auditoria, item P0-13). Serve para qualquer pessoa autorizada publicar ou
socorrer o MDSign sem depender de quem escreveu o código.

Mantenha este arquivo atualizado a cada mudança de ambiente, de segredo ou de processo.

> **Regras que valem sempre** (detalhes no `CLAUDE.md`)
>
> - Nada de senha, chave ou token no chat, no código, no Lovable ou em print. Segredos só pelos
>   scripts com `read -s` (seção 6).
> - Toda publicação de banco ou de funções e todo `git push` têm o "sim" da responsável.
> - Migração só acrescenta: nunca apaga tabela, coluna ou dado, e nunca edite uma migração já
>   aplicada.
> - Nunca use o agente nem os créditos do Lovable. O código chega ao Lovable só por `git push`.
> - Asaas só no Sandbox até autorização expressa.

---

## 1. Ambientes e acessos

| Peça | Onde | Quem precisa de acesso |
|---|---|---|
| Código | GitHub `TIMundoDigital/mdsign-git-import`, ramo `main` | responsável e segundo responsável (escrita) |
| Site | Lovable, projeto `33353745-27fd-4380-8a2b-929ec05aac8b`, publicado em https://mdsign-new.lovable.app | idem (só para **Publish → Update**) |
| Banco, funções e segredos | Supabase, projeto `vrksxqbopteeyeovdwpu` (homologação, us-east-1), organização da MDTech | idem (Owner ou Developer) |
| Motor de assinatura | SignDoc, https://sign.signdocmd.com.br, aplicação "MDSign" | administrador do SignDoc |
| E-mail | Resend, domínio `mail.mundodigitaltech.com.br` (DNS na HostGator) | idem |
| Cobrança | Asaas **Sandbox** | idem |
| WhatsApp | BotConversa | idem |

**Produção ainda não existe.** Quando for criada (em sa-east-1, ver `docs/migracao-sa-east-1.md`),
este runbook ganha uma coluna por ambiente.

### Segundo responsável (pendente)

| Item | Situação |
|---|---|
| Nome do segundo responsável | **a definir** |
| Acesso ao GitHub, Lovable e Supabase da MDTech | **a conceder** |
| Cofre corporativo de senhas (onde guardar as chaves de SignDoc, Resend, Asaas e BotConversa, e a senha do banco) | **a escolher** |

Sem o segundo responsável e o cofre, o MDSign depende de uma única pessoa.

### Preparar um Mac novo (uma vez)

```bash
git clone https://github.com/TIMundoDigital/mdsign-git-import.git mdsign
```

```bash
cd mdsign && git checkout -b main-mdtech origin/main
```

```bash
npx -y bun@1 install --frozen-lockfile
```

```bash
npx supabase login
```

```bash
npx supabase link --project-ref vrksxqbopteeyeovdwpu
```

O `login` abre o navegador. O `link` pede a senha do banco, que fica no cofre e só deve ser
digitada no Terminal.

---

## 2. Publicar uma mudança: ordem segura

Sempre nesta ordem. Pule só os passos que a mudança não tem.

| # | Passo | Comando ou ação | Conferência |
|---|---|---|---|
| 1 | Conferir o estado | `git status` e `git log -5` | sem arquivos inesperados |
| 2 | Testes locais | `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run` | tudo passa |
| 3 | Testes das funções (fora do repositório) | ver seção 7 | tudo passa |
| 4 | Teste da migração no banco, **desfeito no fim** | `bash scripts/test-rls.sh supabase/migrations/<nova>.sql` | "todos os testes de RLS e permissões passaram" |
| 5 | Aplicar a migração | `npx supabase db push --remote --dry-run`, depois `npx supabase db push --remote` | a simulação lista **só** a migração nova |
| 6 | Publicar as funções afetadas | ver abaixo | versões sobem 1, todas ativas |
| 7 | Buscar novidades do Lovable | `git fetch origin` e `git log --oneline HEAD..origin/main` | se houver commit novo: `git rebase origin/main` e repetir o passo 2 |
| 8 | Enviar o código | `git push origin main-mdtech:main` | a verificação do GitHub passa (seção 5) |
| 9 | Publicar o site (se a tela mudou) | Lovable → **Publish → Update** | texto ou tela nova aparece em mdsign-new.lovable.app |

A migração vem antes das funções porque as funções novas podem depender dela. O passo 5 pode falhar
na primeira tentativa por queda de conexão com o banco; repita a simulação antes de aplicar.

### Quais funções publicar

Publique toda função que importa, direta ou indiretamente, um arquivo alterado de
`supabase/functions/_shared/`, e também as próprias funções alteradas. Para listar quem usa
`_shared/billing.ts`, por exemplo:

```bash
grep -ln '_shared/billing.ts' supabase/functions/*/index.ts
```

O `grep` mostra só quem importa direto. Na dúvida, publique a mais: publicar de novo uma função sem
mudança não causa problema.

```bash
for f in documents-send documents-edit; do npx supabase functions deploy $f --use-api || break; done
```

Conferir depois:

```bash
npx supabase functions list -o json
```

```bash
npx supabase migration list --remote
```

---

## 3. Desfazer uma publicação

| O que deu errado | Como desfazer |
|---|---|
| **Função** com problema | Volte o código da função à versão anterior no Git e publique de novo (abaixo). As funções não guardam histórico para reativar. |
| **Migração** com problema | Nunca apague nem edite a migração aplicada. Escreva uma **migração nova** que corrija ou desfaça o efeito, teste com o passo 4 e aplique. |
| **Site** com problema | `git revert <commit>` (cria um commit novo que desfaz), `git push origin main-mdtech:main`, depois **Publish → Update**. Nunca use force push. |
| **Segredo** errado ou vazado | Gere um novo no serviço de origem e grave com o script da seção 6. Depois revogue o antigo no serviço. |

### Publicar uma função na versão de um commit anterior

Use uma cópia separada, sem mexer na pasta de trabalho:

```bash
git worktree add /tmp/mdsign-volta <commit-bom>
```

```bash
cd /tmp/mdsign-volta && npx supabase link --project-ref vrksxqbopteeyeovdwpu && npx supabase functions deploy <funcao> --use-api
```

```bash
cd - && git worktree remove /tmp/mdsign-volta
```

Depois, corrija o código na `main` para não publicar o erro de novo na próxima vez.

---

## 4. Rotinas automáticas (pg_cron)

| Rotina | Quando (UTC) | O que faz |
|---|---|---|
| `mdsign-webhooks-run` | a cada minuto (só chama a função quando há trabalho pendente) | entrega notificações, webhooks e eventos do SignDoc |
| `mdsign-reminders-run` | toda hora, no minuto 7 | lembretes, envio em massa, retenção, cobrança (atraso, suspensão, volta ao Cedro), alertas |
| `mdsign-cron-cleanup` | todo dia às 03:15 | limpa o histórico das rotinas |

O endereço das funções e a senha das rotinas ficam no **Vault** do banco (`mdsign_functions_url` e
`mdsign_cron_secret`). A senha das rotinas é a mesma do segredo `CRON_SECRET`; troque as duas juntas
com `bash scripts/cron-secret.sh`.

Para conferir as últimas execuções (só leitura):

```bash
npx supabase db query --remote --read-only "select jobname, max(start_time) as ultima_execucao, (array_agg(status order by start_time desc))[1] as ultima_situacao from cron.job_run_details d join cron.job j using (jobid) group by jobname"
```

---

## 5. Onde olhar quando algo parece errado

| Sinal | Onde |
|---|---|
| Alertas da plataforma (motor com erro, fila parada, documento incompleto, cobrança a conferir) | Super Admin → **Alertas** (exige código de verificação em duas etapas) |
| Erros do SignDoc (sem dados pessoais) | Super Admin → erros do motor |
| Verificação automática do código | GitHub → **Actions**. Sem login: `https://api.github.com/repos/TIMundoDigital/mdsign-git-import/actions/runs?per_page=3` (limite de 60 consultas por hora) |
| Logs das funções | Supabase → Edge Functions → função → **Logs** |
| Linha do tempo de um documento | página do documento no MDSign |

A verificação do GitHub tem três etapas:
- **verificar:** tipos, lint, testes do app, build e vulnerabilidades;
- **servidor:** tipos e testes das funções;
- **banco:** migrações e as suítes de RLS e comerciais num banco descartável.

---

### Limite por IP nas funções públicas (verificado em 18/11/2026)

As funções públicas (`document-validate`, `public-form`, `data-request`, `lead-submit`,
`growth-track`) limitam pedidos pelo **primeiro** IP do `x-forwarded-for`. Teste com uma função
temporária (já removida): a infraestrutura do Supabase **descarta** o `x-forwarded-for` enviado por
quem chama e monta o próprio, cujo primeiro IP é o real (igual ao `cf-connecting-ip`). Um IP
inventado não chega à função, então o limite não é driblado assim. Se a hospedagem mudar (outro
proxy na frente), repetir o teste antes de confiar nesse cabeçalho.

## 6. Segredos (só os nomes; valores ficam no cofre)

| Segredo | Para que serve | Como trocar |
|---|---|---|
| `SIGNDOC_API_KEY` | chamadas ao SignDoc | `bash scripts/signdoc-key.sh` (testa antes de gravar) |
| `SIGNDOC_WEBHOOK_TOKEN` | autentica os avisos do SignDoc | gerar novo, gravar com `npx supabase secrets set` e atualizar no SignDoc |
| `SIGNDOC_ADMIN_API_KEY` | operações administrativas no SignDoc | idem |
| `RESEND_API_KEY` e `EMAIL_FROM` | e-mail próprio | `bash scripts/resend-key.sh` |
| `RESEND_WEBHOOK_SECRET` | autentica os avisos do Resend | `bash scripts/resend-webhook-secret.sh` |
| `BOTCONVERSA_API_KEY` | WhatsApp | `bash scripts/botconversa-key.sh` |
| `WHATSAPP_WEBHOOK_SECRET` | autentica o "SAIR" do WhatsApp | `bash scripts/whatsapp-webhook-secret.sh` |
| `CRON_SECRET` | autentica as rotinas | `bash scripts/cron-secret.sh` (grava também no Vault) |
| `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN` | cobrança (Sandbox) | ver `docs/asaas-producao.md` |
| `ALLOWED_ORIGINS` | endereços que podem chamar as funções (hoje o site e `http://localhost:5188`) | `npx supabase secrets set` |

Os segredos `SUPABASE_*` são criados pelo próprio Supabase e não se mexem.

Para conferir sem expor nada: `npx supabase secrets list` mostra só os nomes e um resumo (hash) de
cada valor.

---

## 7. Testes das funções sem estragar o `node_modules`

O Deno não pode rodar na raiz do repositório. Use uma cópia:

```bash
rm -rf /tmp/mdsign-deno && cp -R supabase /tmp/mdsign-deno && cd /tmp/mdsign-deno && SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=teste SUPABASE_ANON_KEY=teste SIGNDOC_API_KEY=teste SIGNDOC_WEBHOOK_TOKEN=token-de-teste npx -y deno@2.9.6 test -A tests/
```

Os testes usam banco, login, SignDoc e Asaas simulados (`supabase/tests/fake_backend.ts`). Não
tocam nada de verdade.

---

## 8. Incidentes

### SignDoc fora do ar ou lento

1. Sintomas: envio falha com "serviço de assinatura indisponível", tela de assinatura não abre e
   "Erros do motor" cresce no Super Admin.
2. Nada se perde:
   - um envio que falhou antes de criar o documento devolve a franquia;
   - um envio com resultado incerto fica como "cobrança a conferir";
   - os avisos do SignDoc são reprocessados sozinhos por até 5 tentativas.
3. Ação: confirmar com o administrador do SignDoc e, se necessário, abrir chamado na Lacuna. Avisar
   os clientes do piloto.
4. Depois: conferir os alertas "documentos incompletos" e "cobrança a conferir" no Super Admin.

### E-mail (Resend) fora do ar ou recusando

1. Sintomas: notificações com falha e "e-mail não entregue" na linha do tempo.
2. Novas tentativas são automáticas. Recusa definitiva (remetente ou endereço inválido) aparece na
   hora com o motivo.
3. Se for o domínio: conferir os registros DKIM e DMARC na HostGator e a situação "Verified" no
   Resend.

### Supabase fora do ar

1. O site abre (é servido pelo Lovable), mas login, documentos e funções falham.
2. Acompanhar https://status.supabase.com e avisar os clientes.
3. Nada a fazer no código. Quando voltar, as rotinas retomam sozinhas; conferir os alertas.

### Webhook do Asaas falhando

O evento fica guardado e a rotina de hora em hora tenta de novo, até 10 vezes. Conferir a tabela
`billing_events` (campo `error`) por consulta só de leitura.

### Cópia de segurança e restauração (a confirmar)

- **A confirmar no painel:** o plano do Supabase e se há cópias automáticas (Database → Backups).
  Na conta gratuita, a recuperação a um ponto no tempo (PITR) não está disponível.
- Antes de qualquer cliente real: contratar um plano com cópias automáticas e PITR na produção, e
  **testar uma restauração** num projeto de ensaio pelo menos uma vez por trimestre.
- Cópia manual de emergência (a senha do banco é pedida no Terminal):

```bash
npx supabase db dump --remote -f /tmp/mdsign-esquema.sql
```

```bash
npx supabase db dump --remote --data-only -f /tmp/mdsign-dados.sql
```

O arquivo de dados contém dados pessoais. Guarde só no cofre ou em armazenamento corporativo
criptografado, nunca no repositório nem em e-mail.

---

## 9. Lista rápida antes de cada publicação

- [ ] Testes locais passando (app e funções).
- [ ] Migração testada com `scripts/test-rls.sh` e simulação do `db push` mostrando só ela.
- [ ] Lista das funções afetadas conferida.
- [ ] "Sim" da responsável para banco, funções e push.
- [ ] `git fetch` sem commit novo do Lovable (ou rebase feito e testes repetidos).
- [ ] Verificação do GitHub verde depois do push.
- [ ] Publish → Update no Lovable, se a tela mudou.
- [ ] Conferência no site publicado.
