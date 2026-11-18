# Níveis de autenticação oferecidos na tela

Decisão da homologação de 17/10/2026: o MDSign só oferece um nível de autenticação depois de
testá-lo de verdade com o SignDoc. Até lá, a tela mostra apenas **Padrão (e-mail)**.

## Como funciona

O segredo `SIGNDOC_AUTH_METHODS` (Supabase → Edge Functions → Secrets) lista os métodos
liberados, separados por vírgula. Sem o segredo, só e-mail.

| Método no segredo | Nível na tela | Observação |
|---|---|---|
| `sms` | Reforçada (código por SMS) | Exige celular do participante |
| `whatsapp` | Reforçada (código por WhatsApp) | Exige celular do participante |
| `selfie` | Identidade (selfie) | |
| `datavalid` | Identidade (Datavalid / base do governo) | Exige contrato do Datavalid; não serve para estrangeiros |
| `liveness` | Alta (prova de vida) | |
| `certificate` | Certificado digital ICP-Brasil | Até 17/10/2026 aparecia sempre; agora também depende da lista |

## Histórico

- Até 17/10/2026 o segredo valia `sms,whatsapp,selfie,datavalid` e o certificado aparecia
  sempre. Nenhum desses níveis tinha sido testado em envio real.
- 17/10/2026: segredo removido (só e-mail na tela).

## Para liberar um nível

1. Teste real com o SignDoc: enviar, assinar com o nível e conferir no PDF/manifesto.
2. Registrar a evidência (data, documento, resultado).
3. Gravar o segredo com os métodos aprovados, por exemplo:
   `npx supabase secrets set SIGNDOC_AUTH_METHODS=sms,certificate`

## Conferência da instância (18/11/2026)

- O Super Admin tem o quadro **"Métodos de autenticação no motor"** (função `admin-engine-check`,
  só leitura): lê o contexto de segurança dos 5 documentos mais recentes e dos detalhes das
  assinaturas e compara com `SIGNDOC_AUTH_METHODS`.
- Resultado em 18/11/2026: o SignDoc devolve o campo `securityContext` **vazio** nas duas
  consultas. O MDSign cria os documentos sem `securityContextId` (contexto padrão da instância), e
  a API não tem endpoint para listar contextos. Não dá para saber pela API quais métodos estão
  habilitados.
- Chamado aberto na Lacuna perguntando:
  1. métodos habilitados no contexto padrão (SMS, WhatsApp, selfie, Datavalid, prova de vida);
  2. se há contexto com esses métodos e qual o `securityContextId`;
  3. custo por uso de cada método e o que o contrato inclui;
  4. se a licença do Web PKI cobre outros domínios (erro "Invalid license" no quadro embutido).
- Próximo passo com a resposta: se houver `securityContextId`, enviar esse id na criação dos
  documentos; depois, testar um método por vez (seção "Para liberar um nível").
- Não confundir: **código por WhatsApp na assinatura** (SignDoc) × **convite e lembrete por
  WhatsApp** (MDSign pelo BotConversa, funcionalidade `whatsapp`, hoje oculta).
