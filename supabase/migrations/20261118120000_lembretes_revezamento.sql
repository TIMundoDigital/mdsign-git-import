-- MDSign — Lembretes em revezamento (auditoria de 17/11/2026, D-22). Só acréscimos.
--
-- A rotina de lembretes olhava no máximo 200 documentos pendentes por vez, sem ordem: acima
-- disso, sempre os mesmos ficavam de fora. Agora ela marca quando conferiu cada documento e
-- começa pelos menos conferidos, até todos terem a vez.

alter table public.documents add column if not exists reminders_checked_at timestamptz;
create index if not exists documents_reminders_queue_idx
  on public.documents (reminders_checked_at nulls first, created_at)
  where status = 'pending' and reminders_enabled;
