// Super Admin: confere, SÓ COM LEITURA, quais métodos de autenticação o SignDoc aceita nesta
// instância e quais o MDSign oferece hoje (segredo SIGNDOC_AUTH_METHODS). Não cria nem altera
// nada no motor. O contexto de segurança vem junto com o documento (GET /api/documents/{id}) ou
// com os detalhes das assinaturas (/signatures-details); tenta os documentos mais recentes.

import { admin, requireUser } from "../_shared/auth.ts";
import { AppError, corsHeaders, handleError, json } from "../_shared/http.ts";
import { type EngineSecurityContext, signdoc } from "../_shared/signdoc.ts";

const KNOWN = [
  "email",
  "sms",
  "whatsapp",
  "otp",
  "selfie",
  "datavalid",
  "pix",
  "liveness",
  "idScan",
];
const MAX_DOCS = 5;

const contextOf = (v: unknown) => {
  const ctx = (v as { securityContext?: EngineSecurityContext | null } | null)?.securityContext;
  return ctx && typeof ctx === "object" ? ctx : null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  try {
    if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
    const caller = await requireUser(req);
    const { data: isAdmin } = await caller.asUser.rpc("is_platform_admin");
    if (!isAdmin) throw new AppError("forbidden", 403);

    const offered = (Deno.env.get("SIGNDOC_AUTH_METHODS") ?? "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean);

    const { data: docs } = await admin
      .from("documents")
      .select("engine_document_id, status, created_at")
      .not("engine_document_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_DOCS);
    const list = (docs ?? []) as {
      engine_document_id: string;
      status: string;
      created_at: string;
    }[];
    if (!list.length) return json({ offered, engine: null, reason: "no_documents" }, 200, origin);

    // Para diagnóstico: só os NOMES dos campos que o motor devolveu (nunca os valores).
    const fields: Record<string, string[]> = {};
    let ctx: EngineSecurityContext | null = null;
    let source: string | null = null;
    for (const d of list) {
      try {
        const doc = await signdoc.getDocument(d.engine_document_id);
        fields["document"] ??= Object.keys(doc ?? {}).sort();
        ctx = contextOf(doc);
        if (ctx) {
          source = "document";
          break;
        }
      } catch {
        // Documento excluído no motor ou indisponível: tenta o próximo.
      }
    }
    if (!ctx) {
      // Os detalhes das assinaturas só existem para documentos com alguém que já assinou.
      for (const d of list.filter((x) => x.status === "concluded" || x.status === "pending")) {
        try {
          const info = await signdoc.signaturesDetails(d.engine_document_id);
          fields["signatures"] ??= Object.keys(info ?? {}).sort();
          ctx = contextOf(info);
          if (ctx) {
            source = "signatures";
            break;
          }
        } catch {
          // Sem assinaturas ainda: tenta o próximo.
        }
      }
    }

    const types = ctx?.allowedElectronicTypes ?? {};
    return json(
      {
        offered,
        engine: ctx
          ? {
              context: ctx.portugueseName || ctx.name || null,
              certificate: ctx.allowDigitalSignature ?? null,
              livenessOnSelfie: ctx.requireLivenessOnSelfieAuthentication ?? null,
              methods: Object.fromEntries(KNOWN.map((k) => [k, types[k] ?? null])),
              source,
            }
          : null,
        reason: ctx ? null : "no_context",
        fields,
        documentsChecked: list.length,
        checkedAt: new Date().toISOString(),
      },
      200,
      origin,
    );
  } catch (e) {
    return handleError(e, origin);
  }
});
