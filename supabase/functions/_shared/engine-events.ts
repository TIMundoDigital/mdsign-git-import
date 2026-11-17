// Webhooks do motor (SignDoc): processamento e reprocessamento com espera crescente.
// O payload é só um aviso; o estado verdadeiro vem da API (syncDocument).

import { admin } from "./auth.ts";
import { syncDocument } from "./documents.ts";

const BACKOFF_MIN = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = BACKOFF_MIN.length;

type EventRow = { id: number; type: string; payload: Record<string, unknown>; attempts: number };

function eventIds(payload: Record<string, unknown>) {
  const data = (payload["data"] ?? {}) as { id?: string; documents?: { id?: string }[] };
  return data.id
    ? [String(data.id)]
    : (data.documents ?? []).map((d) => String(d.id ?? "")).filter(Boolean);
}

/** Processa um evento; em erro, agenda a próxima tentativa (até 5). */
export async function processEngineEvent(row: EventRow) {
  try {
    if (row.type !== "DocumentsDeleted" && row.type !== "DocumentDeleted") {
      for (const engineId of eventIds(row.payload)) {
        const { data: doc } = await admin
          .from("documents")
          .select("id, organization_id, status, engine_document_id")
          .eq("engine_document_id", engineId)
          .maybeSingle();
        // Documento de fora do MDSign (ex.: criado no painel): só registra.
        if (doc) await syncDocument(doc);
      }
    }
    await admin
      .from("engine_webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", row.id);
    return true;
  } catch (e) {
    const attempts = row.attempts + 1;
    const wait = BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length) - 1]!;
    console.error("engine event", row.type, attempts, String(e).slice(0, 200));
    await admin
      .from("engine_webhook_events")
      .update({
        attempts,
        error: String(e).slice(0, 500),
        next_attempt_at: new Date(Date.now() + wait * 60_000).toISOString(),
      })
      .eq("id", row.id);
    return false;
  }
}

/** Reprocessa eventos pendentes (chamado pela rotina de minuto). */
export async function processPendingEngineEvents(limit = 20) {
  // Reserva no banco os eventos vencidos (nova tentativa vencida ou recebidos há mais de 1 minuto,
  // tempo em que o próprio webhook ainda está processando). Outra execução ao mesmo tempo pula
  // estes: o mesmo evento não é tratado duas vezes.
  const { data: claimed } = await admin.rpc("claim_engine_events", {
    lim: limit,
    max_attempts: MAX_ATTEMPTS,
  });
  const ids = (claimed as number[] | null) ?? [];
  if (!ids.length) return { reprocessed: 0, failed: 0 };
  const { data } = await admin
    .from("engine_webhook_events")
    .select("id, type, payload, attempts, next_attempt_at, received_at")
    .in("id", ids)
    .order("received_at");
  let ok = 0;
  let failed = 0;
  try {
    for (const row of data ?? []) {
      if (await processEngineEvent(row as EventRow)) ok++;
      else failed++;
    }
  } finally {
    await admin
      .from("engine_webhook_events")
      .update({ locked_until: null })
      .in("id", ids)
      .is("processed_at", null);
  }
  return { reprocessed: ok, failed };
}
