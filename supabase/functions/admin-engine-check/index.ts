// Super Admin: confere, SÓ COM LEITURA, quais métodos de autenticação o SignDoc aceita nesta
// instância (contexto de segurança de um documento recente) e quais o MDSign oferece hoje
// (segredo SIGNDOC_AUTH_METHODS). Não cria nem altera nada no motor.

import { admin, requireUser } from "../_shared/auth.ts";
import { AppError, corsHeaders, handleError, json } from "../_shared/http.ts";
import { signdoc } from "../_shared/signdoc.ts";

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

    // O contexto vem junto com cada documento: usa o mais recente criado no motor.
    const { data: doc } = await admin
      .from("documents")
      .select("engine_document_id, created_at")
      .not("engine_document_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc?.engine_document_id)
      return json({ offered, engine: null, reason: "no_documents" }, 200, origin);

    const engineDoc = await signdoc.getDocument(doc.engine_document_id as string);
    const ctx = engineDoc.securityContext ?? null;
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
            }
          : null,
        reason: ctx ? null : "no_context",
        checkedAt: new Date().toISOString(),
        documentDate: doc.created_at,
      },
      200,
      origin,
    );
  } catch (e) {
    return handleError(e, origin);
  }
});
