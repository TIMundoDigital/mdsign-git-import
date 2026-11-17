-- MDSign — Aviso antes de a conta suspensa voltar ao Cedro (Termos de Uso aprovados, seção 10:
-- "notificação com antecedência mínima de 15 dias, assegurada oportunidade de regularização e
-- exportação"). Só acréscimos.
--
-- Guarda quando o proprietário foi avisado. A volta ao Cedro só acontece depois do prazo contado
-- a partir deste aviso (billing_grace.downgrade_days, padrão 15). Sem aviso enviado, não muda.
-- Um novo pagamento confirmado apaga a marca (o próximo atraso gera novo aviso).

alter table public.subscriptions add column if not exists downgrade_notice_at timestamptz;
comment on column public.subscriptions.downgrade_notice_at is
  'Quando o proprietário foi avisado de que a conta suspensa passará ao Cedro (Termos, seção 10).';
