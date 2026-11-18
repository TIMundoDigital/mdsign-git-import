# LGPD no MDSign: retenção, titular e responsabilidades (rascunho para o Jurídico)

> Rascunho técnico de 18/11/2026. Descreve **o que o sistema já faz** (fatos conferidos no código)
> e **o que precisa de decisão** do Jurídico e do encarregado (DPO). Não substitui parecer
> jurídico. Prazos e papéis marcados como "proposta" não estão aprovados.

## 1. Papéis

| Situação                                                     | Papel da MDTech                       | Observação                                                         |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| Dados da conta (cadastro, membros, cobrança, consentimentos) | Controladora                          | Termos 3.0 e Privacidade 1.0, vigentes em 17/11/2026               |
| Documentos enviados para assinatura e dados de quem assina   | Operadora (o cliente é o controlador) | Confirmar com o Jurídico se os Termos dizem isso de forma expressa |
| Leads do site e dados de campanha                            | Controladora                          | Origem de campanha só com consentimento de análise                 |

Suboperadores em uso: Supabase (banco e arquivos, hoje em **us-east-1**), Lacuna/SignDoc (motor de
assinatura), Resend (e-mail), BotConversa (WhatsApp), Asaas (cobrança, só Sandbox) e Lovable
(hospedagem do site). **Pendente (Jurídico):** mecanismo de transferência internacional (art. 33)
para o que fica fora do Brasil; a produção vai para **sa-east-1** (São Paulo).

## 2. Prazos que o sistema já aplica

| Dado                                                                                                    | Prazo                         | Onde                                                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Encerramento de conta: exportar ou desfazer                                                             | 30 dias                       | `encerramento_conta.sql`                                                  |
| Encerramento de conta: exclusão (documentos, cópias, fluxos salvos, anexos, pastas, unidades, arquivos) | 60º dia                       | `encerramento_conta.sql`, `exclusao_completa.sql`, `_shared/retention.ts` |
| Documento no plano Cedro: disponibilidade                                                               | 6 meses                       | Condições Cedro 1.0; `document-share` respeita                            |
| Link de assinatura enviado por e-mail                                                                   | 7 dias                        | `_shared/notifications.ts`                                                |
| Link de cópia de documento (`/d/…`)                                                                     | 7 dias                        | `document-share`                                                          |
| Convite para a equipe                                                                                   | 7 dias                        | `invitations`                                                             |
| Lote em rascunho sem envio                                                                              | 3 dias                        | `_shared/retention.ts`                                                    |
| Itens com erro de lote, após o fim do lote                                                              | 30 dias                       | `_shared/retention.ts`                                                    |
| PDF de modelo nunca salvo                                                                               | 7 dias                        | `_shared/retention.ts`                                                    |
| Origem de campanha (UTM)                                                                                | 30 dias, só com consentimento | Política de Cookies                                                       |
| Histórico das rotinas automáticas                                                                       | 14 dias                       | `limpeza_historico_rotinas.sql`                                           |
| Resposta ao titular                                                                                     | 15 dias (prazo interno)       | `canal_do_titular.sql`                                                    |

O que **fica** após o encerramento, por decisão anterior: as evidências de assinatura
(`document_events` e `document_versions` são imutáveis) e a auditoria.

## 3. Sem prazo definido (decisão do Jurídico/DPO)

Proposta técnica para discussão. Nada disso está implementado.

| Dado                                                                                      | Hoje                            | Proposta                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Eventos recebidos do SignDoc (`engine_webhook_events`, com o conteúdo enviado pelo motor) | Guardados sem prazo             | Apagar o conteúdo 90 dias após processado, mantendo data e tipo                |
| Auditoria (`audit_log`) e linha do tempo (`document_events`)                              | Sem prazo (prova da assinatura) | Manter pelo prazo prescricional aplicável ao documento; definir com o Jurídico |
| Notificações (e-mail e WhatsApp enviados)                                                 | Sem prazo                       | 1 ano                                                                          |
| Leads do site                                                                             | Sem prazo                       | 2 anos sem contato, ou até o pedido de exclusão                                |
| Pedidos do titular                                                                        | Sem prazo                       | 5 anos após a resposta (prova do atendimento)                                  |
| Erros do motor (`engine_errors`, já sem dados pessoais)                                   | Sem prazo                       | 1 ano                                                                          |
| Tentativas de validação pública                                                           | Sem prazo                       | 90 dias                                                                        |

Também pendente: indicação do **encarregado (DPO)** e o canal de contato dele na Política de
Privacidade.

## 4. Atendimento ao titular

1. O pedido chega pelo formulário **/titular** (acesso, correção, exclusão, portabilidade,
   compartilhamento, revogação de consentimento, oposição). O sistema gera um protocolo e um prazo
   interno de 15 dias.
2. O Super Admin vê o pedido em **Pedidos de titulares (LGPD)**: confirma a identidade (marca "identidade
   conferida"), registra o andamento e responde. Cada passo fica no histórico do pedido.
3. Se o dado pertence a um **documento de cliente** (MDTech como operadora), o pedido é
   encaminhado à empresa que enviou o documento (situação "encaminhado"), com aviso ao titular.
4. Exclusão de conta: pelo proprietário da conta em Organização → "Exportar e encerrar" (o Super Admin não tem esse botão hoje). Seguem os
   prazos da seção 2. Evidências de assinatura não são apagadas (base legal: exercício regular de
   direitos; confirmar texto com o Jurídico).
5. **Responsável:** a definir (proposta: DPO, com apoio técnico do responsável pelo MDSign).

## 5. Incidente com dados pessoais

1. Quem perceber avisa o responsável técnico e o DPO no mesmo dia.
2. Conter: revogar chaves (`scripts/*-key.sh`), suspender a função afetada, preservar os
   registros (`docs/runbook.md`, seção 8).
3. Avaliar risco e quem foi afetado, só com consultas de leitura.
4. Comunicação à ANPD e aos titulares quando houver risco ou dano relevante, no prazo da
   regulamentação vigente (Resolução CD/ANPD nº 15/2024; **confirmar o prazo com o Jurídico**).
5. Registrar o incidente, as decisões e as evidências, mesmo quando não houver comunicação.

## 6. Responsabilidades operacionais (proposta)

| Atividade                                  | Responsável                                               | Apoio                           |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------- |
| Publicação (banco, funções, site)          | Responsável pelo MDSign                                   | Segundo responsável (a definir) |
| Segredos e chaves                          | Responsável pelo MDSign, no cofre corporativo (a definir) | —                               |
| Pedidos do titular                         | DPO (a definir)                                           | Responsável pelo MDSign         |
| Incidentes                                 | DPO + responsável pelo MDSign                             | Jurídico                        |
| Revisão dos prazos de retenção             | Jurídico + DPO                                            | —                               |
| Cópias de segurança e teste de restauração | Responsável pelo MDSign                                   | Ver seção 7                     |

## 7. Cópias de segurança

Situação em 18/11/2026 (conferida pelo CLI): o projeto `vrksxqbopteeyeovdwpu` está no **plano
gratuito**, **sem cópias diárias disponíveis** e **sem PITR** (recuperação para um ponto no tempo).
Para a produção: plano pago com cópias diárias e, de preferência, PITR; teste de restauração
documentado antes do lançamento (ver `docs/migracao-sa-east-1.md`).
