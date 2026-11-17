// Cópia do documento concluído para e-mails de fora do fluxo (cliente, contador, jurídico).
// - "send" (logado: quem criou ou quem gerencia documentos): até 10 e-mails, link próprio por
//   pessoa, válido por 7 dias. O e-mail sai pelo MDSign (Resend).
// - "open" (público, pelo link): confere o token e devolve um link curto do motor para baixar o
//   PDF assinado. Nada do arquivo fica guardado no MDSign.
// - "revoke" (logado, mesmas permissões do envio): o link deixa de abrir na hora.
// No Cedro, a cópia segue o prazo do documento (6 meses a partir da criação): não é enviada
// depois dele, o link não passa dele e não abre depois dele.

import { admin, requireUser } from "../_shared/auth.ts";
import { emailConfigured, emailTestMode, sendEmail, shareEmail } from "../_shared/email.ts";
import { AppError, corsHeaders, handleError, json } from "../_shared/http.ts";
import { hashToken, siteUrl } from "../_shared/notifications.ts";
import { signdoc } from "../_shared/signdoc.ts";

const DAYS = 7;
const MAX_EMAILS = 10;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const randomToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
/** Fim da disponibilidade do documento no plano (Cedro: 6 meses); null = sem prazo. */
async function availableUntil(documentId: string): Promise<Date | null> {
  const { data } = await admin.rpc("document_available_until", { doc: documentId });
  return data ? new Date(data as string) : null;
}
const expiredInPlan = async (documentId: string) => {
  const until = await availableUntil(documentId);
  return Boolean(until && until.getTime() < Date.now());
};

const mask = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  try {
    if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body["action"] === "open") {
      const token = String(body["token"] ?? "");
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new AppError("link_invalid", 404);
      const { data: share } = await admin
        .from("document_shares")
        .select(
          "id, document_id, organization_id, email, expires_at, revoked_at, opened_at, open_count",
        )
        .eq("token_hash", await hashToken(token))
        .maybeSingle();
      if (!share || share.revoked_at) throw new AppError("link_invalid", 404);
      if (new Date(share.expires_at).getTime() < Date.now())
        throw new AppError("link_expired", 410);
      const { data: doc } = await admin
        .from("documents")
        .select("name, status, engine_document_id, deleted_at, organizations(name)")
        .eq("id", share.document_id)
        .single();
      if (!doc || doc.deleted_at || doc.status !== "concluded")
        throw new AppError("link_invalid", 404);
      if (await expiredInPlan(share.document_id)) throw new AppError("link_expired", 410);
      const ticket = await signdoc.ticket(doc.engine_document_id, "Signatures");
      const url = ticket.location.startsWith("http")
        ? ticket.location
        : `${signdoc.baseUrl}${ticket.location}`;
      // 1ª abertura vira evento na linha do tempo (só quem marca primeiro grava).
      const { data: first } = await admin
        .from("document_shares")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", share.id)
        .is("opened_at", null)
        .select("id");
      if (first?.length)
        await admin.from("document_events").insert({
          document_id: share.document_id,
          organization_id: share.organization_id,
          type: "document.share_opened",
          actor_name: mask(share.email),
          source: "mdsign",
          data: {},
        });
      await admin
        .from("document_shares")
        .update({ open_count: share.open_count + 1 })
        .eq("id", share.id);
      const org = (doc.organizations as { name?: string } | null)?.name ?? "";
      return json({ url, name: doc.name, organization: org }, 200, origin);
    }

    const caller = await requireUser(req);

    // ---- Revogar uma cópia enviada ----
    if (body["action"] === "revoke") {
      const shareId = String(body["shareId"] ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(shareId)) throw new AppError("invalid_request");
      const { data: share } = await admin
        .from("document_shares")
        .select("id, document_id, organization_id, email, revoked_at")
        .eq("id", shareId)
        .maybeSingle();
      if (!share) throw new AppError("link_invalid", 404);
      // Mesma regra do envio: quem vê o documento e (criou ou gerencia documentos).
      const { data: owner } = await caller.asUser
        .from("documents")
        .select("id, created_by, organization_id")
        .eq("id", share.document_id)
        .maybeSingle();
      if (!owner) throw new AppError("document_not_found", 404);
      const { data: canManage } = await caller.asUser.rpc("has_org_permission", {
        org: owner.organization_id,
        perm: "documents.manage",
      });
      if (owner.created_by !== caller.user.id && !canManage) throw new AppError("forbidden", 403);
      if (share.revoked_at) return json({ revoked: true }, 200, origin);
      const { data: changed } = await admin
        .from("document_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", share.id)
        .is("revoked_at", null)
        .select("id");
      if (changed?.length) {
        await admin.from("document_events").insert({
          document_id: share.document_id,
          organization_id: share.organization_id,
          type: "document.share_revoked",
          actor_name: caller.profile.full_name ?? caller.user.email ?? null,
          source: "mdsign",
          data: { to: mask(share.email) },
        });
        await admin.rpc("write_audit_as", {
          org: share.organization_id,
          actor: caller.user.id,
          act: "document.share_revoked",
          ent: "document",
          ent_id: share.document_id,
          payload: { share: share.id },
        });
      }
      return json({ revoked: true }, 200, origin);
    }

    // ---- Enviar cópias ----
    const documentId = String(body["documentId"] ?? "");
    const { data: doc } = await caller.asUser
      .from("documents")
      .select("id, name, status, organization_id, created_by, organizations(name, locale)")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!doc) throw new AppError("document_not_found", 404);
    const { data: manage } = await caller.asUser.rpc("has_org_permission", {
      org: doc.organization_id,
      perm: "documents.manage",
    });
    if (doc.created_by !== caller.user.id && !manage) throw new AppError("forbidden", 403);
    if (doc.status !== "concluded") throw new AppError("document_not_concluded", 409);
    // Cedro: depois do prazo do documento não há cópia; antes dele, o link não passa do prazo.
    const until = await availableUntil(doc.id);
    if (until && until.getTime() < Date.now())
      throw new AppError("cedro_document_expired", 403, { until: until.toISOString() });
    if (!emailConfigured()) throw new AppError("email_not_configured", 503);

    const emails = [
      ...new Set(
        (Array.isArray(body["emails"]) ? body["emails"] : [])
          .map((e) => String(e).trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (!emails.length || emails.length > MAX_EMAILS || emails.some((e) => !EMAIL.test(e)))
      throw new AppError("invalid_emails", 422, { max: MAX_EMAILS });
    const message = String(body["message"] ?? "")
      .trim()
      .slice(0, 500);
    const org = doc.organizations as { name?: string; locale?: string } | null;
    const expires = new Date(
      Math.min(Date.now() + DAYS * 86400000, until?.getTime() ?? Number.POSITIVE_INFINITY),
    ).toISOString();
    // Dias informados no e-mail: os 7 de sempre ou o que falta até o prazo do plano.
    const days = Math.max(1, Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000));

    const sent: string[] = [];
    const failed: string[] = [];
    for (const email of emails) {
      const token = randomToken();
      const { error } = await admin.from("document_shares").insert({
        document_id: doc.id,
        organization_id: doc.organization_id,
        email,
        token_hash: await hashToken(token),
        expires_at: expires,
        created_by: caller.user.id,
      });
      if (error) {
        failed.push(email);
        continue;
      }
      try {
        const mail = shareEmail({
          locale: org?.locale ?? "pt",
          senderName: caller.profile.full_name ?? "",
          orgName: org?.name ?? "MDSign",
          docName: doc.name,
          message,
          link: `${siteUrl()}/d/${token}`,
          days,
          // Página de validação no idioma do e-mail (antes era sempre /pt).
          validateUrl: `${siteUrl()}/${["pt", "en", "es"].includes(org?.locale ?? "") ? org!.locale : "pt"}/validar`,
        });
        await sendEmail({ to: email, ...mail, idempotencyKey: `share:${token}` });
        sent.push(email);
      } catch (e) {
        console.error("share", e);
        failed.push(email);
        await admin
          .from("document_shares")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", await hashToken(token));
      }
    }
    if (sent.length) {
      await admin.from("document_events").insert({
        document_id: doc.id,
        organization_id: doc.organization_id,
        type: "document.shared",
        actor_name: caller.profile.full_name ?? caller.user.email ?? null,
        source: "mdsign",
        data: { to: sent.map(mask), days },
      });
      await admin.rpc("write_audit_as", {
        org: doc.organization_id,
        actor: caller.user.id,
        act: "document.shared",
        ent: "document",
        ent_id: doc.id,
        payload: { recipients: sent.length },
      });
    }
    return json(
      { sent: sent.length, failed: failed.map(mask), testMode: emailTestMode() },
      200,
      origin,
    );
  } catch (e) {
    return handleError(e, origin);
  }
});
