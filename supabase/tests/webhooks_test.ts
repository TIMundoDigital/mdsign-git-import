// Webhooks de entrada do Resend (situação dos e-mails) e do Asaas (cobrança), com banco e
// serviços simulados (fake_backend.ts). O código real roda sem alteração; só o fetch é trocado.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

// Configuração lida pelos módulos: valores fictícios, definidos antes de importar.
const RAW_KEY = crypto.getRandomValues(new Uint8Array(24));
const RESEND_SECRET = `whsec_${btoa(String.fromCharCode(...RAW_KEY))}`;
Deno.env.set("RESEND_WEBHOOK_SECRET", RESEND_SECRET);
Deno.env.set("ASAAS_ENV", "sandbox");
Deno.env.set("ASAAS_API_KEY", "$aact_hmlg_teste");
Deno.env.set("ASAAS_WEBHOOK_TOKEN", "asaas-token-de-teste-com-mais-de-32-caracteres");

type Handler = (req: Request) => Promise<Response>;
async function handlerOf(path: string): Promise<Handler> {
  let h: Handler | null = null;
  const serve = Deno.serve;
  (Deno as unknown as { serve: unknown }).serve = (fn: Handler) => {
    h = fn;
    return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
  };
  try {
    await import(path);
  } finally {
    (Deno as unknown as { serve: unknown }).serve = serve;
  }
  return h!;
}
const resend = await handlerOf("../functions/resend-webhook/index.ts");
const asaasHook = await handlerOf("../functions/asaas-webhook/index.ts");
const { validSignature } = await import("../functions/resend-webhook/index.ts");

// ---------- Resend ----------

async function svixHeaders(body: string, ts = Math.floor(Date.now() / 1000)) {
  const id = `msg_${crypto.randomUUID()}`;
  const key = await crypto.subtle.importKey(
    "raw",
    RAW_KEY,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)),
  );
  return {
    "svix-id": id,
    "svix-timestamp": String(ts),
    "svix-signature": `v1,${btoa(String.fromCharCode(...mac))}`,
  };
}

function resendScenario() {
  return installFakeBackend({
    tables: {
      notifications: [
        {
          id: "n-1",
          document_id: "doc-1",
          organization_id: "org-1",
          participant_id: "p-1",
          kind: "signature_requested",
          channel: "email",
          status: "sent",
          provider_message_id: "email-123",
          delivered_at: null,
          opened_at: null,
        },
      ],
      document_participants: [{ id: "p-1", name: "Bia" }],
    },
  });
}

const resendPost = async (event: Record<string, unknown>, headers?: Record<string, string>) => {
  const body = JSON.stringify(event);
  return await resend(
    new Request("http://local/resend-webhook", {
      method: "POST",
      headers: headers ?? (await svixHeaders(body)),
      body,
    }),
  );
};

Deno.test("Resend: assinatura Svix válida, errada ou fora do prazo", async () => {
  const body = '{"type":"email.delivered"}';
  const h = await svixHeaders(body);
  assert(
    await validSignature(
      RESEND_SECRET,
      h["svix-id"],
      h["svix-timestamp"],
      body,
      h["svix-signature"],
    ),
  );
  assert(
    !(await validSignature(
      RESEND_SECRET,
      h["svix-id"],
      h["svix-timestamp"],
      body + " ",
      h["svix-signature"],
    )),
    "corpo alterado",
  );
  assert(
    !(await validSignature(
      "whsec_" + btoa("outra-chave"),
      h["svix-id"],
      h["svix-timestamp"],
      body,
      h["svix-signature"],
    )),
    "outra chave",
  );
  const old = await svixHeaders(body, Math.floor(Date.now() / 1000) - 3600);
  assert(
    !(await validSignature(
      RESEND_SECRET,
      old["svix-id"],
      old["svix-timestamp"],
      body,
      old["svix-signature"],
    )),
    "há 1 hora",
  );
});

Deno.test(
  "Resend: entregue e aberto entram uma vez na linha do tempo; devolvido falha",
  async () => {
    const fake = resendScenario();
    const n = () => fake.tables["notifications"]![0]!;
    const types = () => (fake.tables["document_events"] ?? []).map((e) => e["type"]);
    try {
      assertEquals((await resendPost({ type: "email.delivered" }, { "svix-id": "x" })).status, 401);
      assertEquals(n()["status"], "sent", "sem assinatura não muda nada");

      const delivered = {
        type: "email.delivered",
        created_at: "2026-11-17T10:00:00Z",
        data: { email_id: "email-123" },
      };
      assertEquals((await resendPost(delivered)).status, 200);
      assertEquals(n()["status"], "delivered");
      assertEquals(n()["delivered_at"], "2026-11-17T10:00:00Z");
      await resendPost(delivered); // aviso repetido
      await resendPost({
        type: "email.opened",
        created_at: "2026-11-17T10:05:00Z",
        data: { email_id: "email-123" },
      });
      await resendPost({
        type: "email.clicked",
        created_at: "2026-11-17T10:06:00Z",
        data: { email_id: "email-123" },
      });
      assertEquals(types(), ["notification.delivered", "participant.email_opened"]);
      assertEquals(n()["opened_at"], "2026-11-17T10:05:00Z");

      await resendPost({ type: "email.bounced", data: { email_id: "email-123" } });
      assertEquals(n()["status"], "failed");
      assertEquals(n()["error"], "bounced");

      // E-mail que não é do MDSign: só confirma.
      const other = await resendPost({ type: "email.delivered", data: { email_id: "outro" } });
      assertEquals((await other.json()).ignored, true);
    } finally {
      fake.restore();
    }
  },
);

// ---------- Asaas ----------

const ORG = "org-asaas";
function asaasScenario() {
  const asaasCalls: string[] = [];
  const fake = installFakeBackend({
    tables: {
      subscriptions: [
        {
          organization_id: ORG,
          plan_id: "cedro",
          status: "active",
          billing_status: "none",
          asaas_customer_id: "cus_1",
          asaas_subscription_id: null,
          past_due_since: null,
          cancel_at: null,
          next_due_date: null,
        },
      ],
      billing_checkouts: [
        {
          id: "chk-1",
          organization_id: ORG,
          plan_id: "jacaranda",
          status: "pending",
          asaas_checkout_id: "ck_1",
          asaas_subscription_id: null,
        },
      ],
    },
    unique: { billing_events: [["id"]], billing_payments: [["asaas_payment_id"]] },
    http: (req, url) => {
      if (!url.host.includes("asaas.com")) return undefined;
      asaasCalls.push(`${req.method} ${url.pathname}`);
      const m = /\/v3\/subscriptions\/([\w-]+)$/.exec(url.pathname);
      if (req.method === "GET" && m)
        return Response.json({
          id: m[1],
          customer: "cus_1",
          status: "ACTIVE",
          value: 39.9,
          nextDueDate: "2026-12-17",
          checkoutSession: "ck_1",
        });
      return Response.json({ deleted: true });
    },
  });
  return { fake, asaasCalls };
}

const asaasPost = (body: unknown, token = Deno.env.get("ASAAS_WEBHOOK_TOKEN")!) =>
  asaasHook(
    new Request("http://local/asaas-webhook", {
      method: "POST",
      headers: { "asaas-access-token": token },
      body: JSON.stringify(body),
    }),
  );

const paid = (id: string, status = "CONFIRMED", event = "PAYMENT_CONFIRMED") => ({
  id,
  event,
  payment: {
    id: "pay_1",
    customer: "cus_1",
    subscription: "sub_1",
    value: 39.9,
    status,
    billingType: "CREDIT_CARD",
    confirmedDate: "2026-11-17",
  },
});

Deno.test("Asaas: token errado é recusado e nada é gravado", async () => {
  const { fake } = asaasScenario();
  try {
    assertEquals((await asaasPost(paid("evt_0"), "errado")).status, 401);
    assertEquals(fake.tables["billing_events"] ?? [], []);
  } finally {
    fake.restore();
  }
});

Deno.test("Asaas: pagamento confirmado ativa o plano do checkout, uma vez só", async () => {
  const { fake } = asaasScenario();
  const sub = () => fake.tables["subscriptions"]![0]!;
  try {
    assertEquals((await asaasPost(paid("evt_1"))).status, 200);
    assertEquals(sub()["plan_id"], "jacaranda");
    assertEquals(sub()["status"], "active");
    assertEquals(sub()["asaas_subscription_id"], "sub_1");
    assertEquals(sub()["next_due_date"], "2026-12-17");
    assertEquals(fake.tables["billing_checkouts"]![0]!["status"], "paid");
    assert(fake.tables["billing_events"]![0]!["processed_at"], "evento marcado como processado");

    // O Asaas reenvia o mesmo evento: confirma sem reprocessar.
    const again = await asaasPost(paid("evt_1"));
    assertEquals((await again.json()).duplicate, true);
    const changes = (fake.tables["audit_calls"] ?? []).filter((a) => a["act"] === "plan.changed");
    assertEquals(changes.length, 1, "o plano muda uma vez só");
  } finally {
    fake.restore();
  }
});

Deno.test(
  "Asaas: aviso atrasado não desfaz pagamento recebido; atraso suspende o acesso",
  async () => {
    const { fake } = asaasScenario();
    const payment = () => fake.tables["billing_payments"]![0]!;
    try {
      await asaasPost(paid("evt_1", "RECEIVED", "PAYMENT_RECEIVED"));
      assertEquals(payment()["status"], "RECEIVED");
      // "Confirmado" chegando depois do "recebido" (fora de ordem): continua recebido.
      await asaasPost(paid("evt_2", "CONFIRMED", "PAYMENT_CONFIRMED"));
      assertEquals(payment()["status"], "RECEIVED");

      // Fatura seguinte vence: a assinatura fica em atraso (sem apagar nada).
      await asaasPost({
        id: "evt_3",
        event: "PAYMENT_OVERDUE",
        payment: {
          id: "pay_2",
          customer: "cus_1",
          subscription: "sub_1",
          value: 39.9,
          status: "OVERDUE",
        },
      });
      const sub = fake.tables["subscriptions"]![0]!;
      assertEquals(sub["status"], "past_due");
      assertEquals(sub["billing_status"], "overdue");
      assertEquals(sub["plan_id"], "jacaranda", "o plano não é apagado");
    } finally {
      fake.restore();
    }
  },
);

Deno.test("Asaas: cliente que não é do MDSign é só registrado", async () => {
  const { fake, asaasCalls } = asaasScenario();
  try {
    const r = await asaasPost({
      id: "evt_9",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_x", customer: "cus_outro", subscription: "sub_x", status: "CONFIRMED" },
    });
    assertEquals(r.status, 200);
    assertEquals(fake.tables["subscriptions"]![0]!["plan_id"], "cedro");
    assertEquals(asaasCalls, [], "não consulta o Asaas");
    assertEquals(fake.tables["billing_events"]!.length, 1);
  } finally {
    fake.restore();
  }
});

const { runBilling } = await import("../functions/_shared/billing.ts");

const reversal = (id: string, event: string, status: string) => ({
  id,
  event,
  payment: { id: "pay_1", customer: "cus_1", subscription: "sub_1", value: 39.9, status },
});

Deno.test("Asaas: estorno suspende; novo pagamento regulariza", async () => {
  const { fake } = asaasScenario();
  const sub = () => fake.tables["subscriptions"]![0]!;
  const acts = () => (fake.tables["audit_calls"] ?? []).map((a) => a["act"]);
  try {
    await asaasPost(paid("evt_1"));
    assertEquals(sub()["status"], "active");
    await asaasPost(reversal("evt_r", "PAYMENT_REFUNDED", "REFUNDED"));
    assertEquals(sub()["status"], "suspended", "estorno bloqueia novas operações");
    assertEquals(sub()["plan_id"], "jacaranda", "nada é apagado");
    assert(sub()["past_due_since"], "conta o prazo para voltar ao Cedro");
    assert(acts().includes("billing.refunded"));

    // Cliente paga de novo a mesma assinatura: volta ao normal.
    await asaasPost({
      id: "evt_novo",
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_3",
        customer: "cus_1",
        subscription: "sub_1",
        value: 39.9,
        status: "RECEIVED",
        paymentDate: "2026-11-20",
      },
    });
    assertEquals(sub()["status"], "active");
    assertEquals(sub()["past_due_since"], null);
    assert(acts().includes("billing.regularized"));
  } finally {
    fake.restore();
  }
});

Deno.test("Asaas: chargeback suspende; estorno parcial não", async () => {
  const { fake } = asaasScenario();
  const sub = () => fake.tables["subscriptions"]![0]!;
  try {
    await asaasPost(paid("evt_1"));
    await asaasPost(reversal("evt_p", "PAYMENT_PARTIALLY_REFUNDED", "RECEIVED"));
    assertEquals(sub()["status"], "active", "desconto parcial não suspende");
    await asaasPost(reversal("evt_c", "PAYMENT_CHARGEBACK_REQUESTED", "CHARGEBACK_REQUESTED"));
    assertEquals(sub()["status"], "suspended");
    assert((fake.tables["audit_calls"] ?? []).some((a) => a["act"] === "billing.chargeback"));
  } finally {
    fake.restore();
  }
});

Deno.test(
  "Asaas: conta suspensa recebe aviso e só volta ao Cedro 15 dias depois dele",
  async () => {
    const { fake, asaasCalls } = asaasScenario();
    const emails: string[] = [];
    Deno.env.set("RESEND_API_KEY", Deno.env.get("RESEND_API_KEY") || "re_teste");
    Deno.env.set("EMAIL_FROM", Deno.env.get("EMAIL_FROM") || "MDSign <nao-responda@mdsign.test>");
    const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    const sub = (org: string, notice: string | null) => ({
      organization_id: org,
      plan_id: "ipe",
      status: "suspended",
      billing_status: "overdue",
      asaas_subscription_id: `sub_${org}`,
      past_due_since: days(40),
      downgrade_notice_at: notice,
      cancel_at: null,
    });
    fake.tables["subscriptions"] = [
      sub("org-avisada", days(16)),
      sub("org-no-prazo", days(10)),
      sub("org-sem-aviso", null),
    ];
    fake.tables["organizations"] = [
      { id: "org-sem-aviso", name: "Empresa Sem Aviso", locale: "pt" },
    ];
    fake.tables["memberships"] = [
      { organization_id: "org-sem-aviso", user_id: "66666666-6666-4666-8666-666666666666", role: "owner", status: "active" },
      { organization_id: "org-sem-aviso", user_id: "u-colega", role: "member", status: "active" },
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname === "/auth/v1/admin/users/66666666-6666-4666-8666-666666666666")
        return Response.json({ id: "66666666-6666-4666-8666-666666666666", email: "dona@ex.com", aud: "authenticated" });
      if (req.url.startsWith("https://api.resend.com")) {
        const body = (await req.json()) as { to: string | string[]; subject: string };
        emails.push(`${String(body.to)} | ${body.subject}`);
        return Response.json({ id: "email-1" });
      }
      return originalFetch(req);
    };
    try {
      const out = await runBilling();
      const [avisada, noPrazo, semAviso] = fake.tables["subscriptions"]!;
      // Aviso enviado há 16 dias: volta ao Cedro e para de cobrar.
      assertEquals(avisada!["plan_id"], "cedro");
      assert(asaasCalls.includes("DELETE /v3/subscriptions/sub_org-avisada"));
      // Aviso há 10 dias: ainda dentro do prazo.
      assertEquals(noPrazo!["plan_id"], "ipe");
      assertEquals(noPrazo!["status"], "suspended");
      // Sem aviso: recebe o e-mail agora (só a proprietária) e não muda de plano.
      assertEquals(semAviso!["plan_id"], "ipe");
      assert(semAviso!["downgrade_notice_at"], "aviso registrado");
      assertEquals(emails.length, 1);
      assert(
        emails[0]!.startsWith(
          "dona@ex.com | Ação necessária: a conta Empresa Sem Aviso passará ao plano Cedro",
        ),
      );
      assertEquals([out.notified, out.downgraded], [1, 1]);
      assert(!asaasCalls.some((c) => c.includes("org-no-prazo") || c.includes("org-sem-aviso")));
    } finally {
      globalThis.fetch = originalFetch;
      fake.restore();
    }
  },
);

// ---------- Troca de plano (checkout) ----------

const billingFn = await handlerOf("../functions/billing/index.ts");

Deno.test("checkout: plano menor que os usuários ativos é recusado antes do Asaas", async () => {
  const asaasCalls: string[] = [];
  const fake = installFakeBackend({
    users: { "token-dono": { id: "u-dono", email: "dono@ex.com" } },
    tables: {
      profiles: [{ id: "u-dono", full_name: "Dono", cpf: null, no_cpf: false, locale: "pt" }],
      subscriptions: [
        {
          organization_id: ORG,
          plan_id: "ipe",
          provider: "asaas",
          asaas_subscription_id: "sub_1",
          cancel_at: null,
        },
      ],
      billing_checkouts: [],
    },
    rpc: {
      has_org_permission: () => true,
      plan_offer: () => ({
        plans: [
          { id: "jacaranda", name: "Jacarandá", price_cents: 3990, is_public: true },
          { id: "ipe", name: "Ipê", price_cents: 9997, is_public: true },
        ],
      }),
      plan_users_fit: (a) =>
        a["target_plan"] === "jacaranda"
          ? { fits: false, active: 3, max: 1 }
          : { fits: true, active: 3, max: 4 },
    },
    http: (req, url) => {
      if (!url.host.includes("asaas.com")) return undefined;
      asaasCalls.push(`${req.method} ${url.pathname}`);
      return Response.json({});
    },
  });
  try {
    const r = await billingFn(
      new Request("http://local/billing", {
        method: "POST",
        headers: { authorization: "Bearer token-dono", "content-type": "application/json" },
        body: JSON.stringify({ action: "checkout", organizationId: ORG, planId: "jacaranda" }),
      }),
    );
    assertEquals(r.status, 409);
    assertEquals(await r.json(), {
      error: "plan_users_over_limit",
      details: { active: 3, max: 1 },
    });
    assertEquals(asaasCalls, [], "nada foi criado no Asaas");
    assertEquals(fake.tables["billing_checkouts"], [], "nenhum pedido gravado");
  } finally {
    fake.restore();
  }
});
