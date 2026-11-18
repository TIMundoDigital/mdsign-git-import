// Recusa de documento (devolução para correção e rejeição definitiva) pela função
// documents-action, com banco, login e SignDoc simulados (fake_backend.ts). O código real roda
// sem alteração. As regras de acesso (RLS) não são simuladas: são testadas em rls.sql.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");

let action: (req: Request) => Promise<Response> = () => Promise.reject(new Error("sem handler"));
const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (h: typeof action) => {
  action = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("../functions/documents-action/index.ts");
(Deno as unknown as { serve: unknown }).serve = serve;

const ENGINE_ID = "33333333-3333-4333-8333-333333333333";
const BIA = { id: "u-bia", email: "bia@ex.com" };
const CAIO = { id: "u-caio", email: "caio@ex.com" };

function scenario() {
  const fake = installFakeBackend({
    users: { "token-bia": BIA, "token-caio": CAIO },
    tables: {
      profiles: [
        { id: BIA.id, full_name: "Bia", cpf: null, no_cpf: false, locale: "pt" },
        { id: CAIO.id, full_name: "Caio", cpf: null, no_cpf: false, locale: "pt" },
      ],
      documents: [
        {
          id: "doc-r",
          organization_id: "org-1",
          created_by: "u-dono",
          status: "pending",
          engine_document_id: ENGINE_ID,
          own_email: false,
          refusal_kind: null,
        },
      ],
      document_versions: [{ document_id: "doc-r", number: 2, created_at: "2026-11-17T09:00:00Z" }],
      document_participants: [
        {
          id: "p-bia",
          document_id: "doc-r",
          organization_id: "org-1",
          user_id: BIA.id,
          name: "Bia",
          email: BIA.email,
          cpf: "52998224725",
          role: "approver",
          step: 1,
          rule_key: null,
          rule_name: null,
          status: "pending",
          engine_flow_action_id: "ar1",
        },
      ],
    },
  });
  fake.engine.documents[ENGINE_ID] = {
    id: ENGINE_ID,
    name: "Contrato",
    status: "Pending",
    creationDate: "2026-11-17T08:00:00Z",
    updateDate: "2026-11-17T09:00:00Z",
    flowActions: [
      {
        id: "ar1",
        type: "Approver",
        status: "Pending",
        step: 1,
        user: { email: BIA.email, identifier: "52998224725" },
      },
    ],
  };
  return fake;
}

const refuse = (token: string, body: Record<string, unknown>) =>
  action(
    new Request("http://local/documents-action", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ documentId: "doc-r", action: "refuse", ...body }),
    }),
  );

Deno.test(
  "recusa: devolução para correção registra a pessoa, a versão e avisa o motor",
  async () => {
    const fake = scenario();
    try {
      const r = await refuse("token-bia", { kind: "return", reason: "Falta a cláusula 4" });
      assertEquals(r.status, 200);
      assertEquals(await r.json(), { status: "refused", kind: "return" });
      const doc = fake.tables["documents"]![0]!;
      assertEquals(doc["refusal_kind"], "return");
      assertEquals(doc["status"], "refused", "sincronizado com o motor");
      assertEquals(fake.tables["document_participants"]![0]!["status"], "refused");
      const ev = fake.tables["document_events"]!.find((e) => e["type"] === "participant.returned")!;
      assertEquals(ev["actor_name"], "Bia");
      assertEquals((ev["data"] as Record<string, unknown>)["version"], 2);
      assertEquals(fake.engine.refusals.length, 1);
      assert(
        fake.engine.refusals[0]!.reason.startsWith("Devolvido para correção por Bia pelo MDSign"),
      );
      assertEquals(
        (fake.tables["audit_calls"] ?? []).map((a) => a["act"]),
        ["document.returned"],
      );
    } finally {
      fake.restore();
    }
  },
);

Deno.test("recusa: rejeição definitiva, e uma segunda decisão é recusada", async () => {
  const fake = scenario();
  try {
    const r = await refuse("token-bia", { kind: "reject", reason: "Fornecedor descredenciado" });
    assertEquals(r.status, 200);
    assertEquals(fake.tables["documents"]![0]!["refusal_kind"], "reject");
    assert(fake.engine.refusals[0]!.reason.startsWith("Rejeitado definitivamente por Bia"));
    const again = await refuse("token-bia", { kind: "return", reason: "Mudei de ideia" });
    assertEquals(again.status, 409);
    assertEquals((await again.json()).error, "document_not_pending");
    assertEquals(fake.engine.refusals.length, 1, "o motor recebe uma recusa só");
  } finally {
    fake.restore();
  }
});

Deno.test("recusa: falha no motor desfaz a marcação e nada muda", async () => {
  const fake = scenario();
  fake.engine.failRefusal = true;
  try {
    const r = await refuse("token-bia", { kind: "reject", reason: "Fornecedor descredenciado" });
    assert(r.status >= 400);
    const doc = fake.tables["documents"]![0]!;
    assertEquals(doc["refusal_kind"], null, "marcação desfeita: pode tentar de novo");
    assertEquals(doc["status"], "pending");
    assertEquals(fake.tables["document_participants"]![0]!["status"], "pending");
    assertEquals(
      (fake.tables["document_events"] ?? []).filter((e) =>
        String(e["type"]).startsWith("participant."),
      ),
      [],
    );
  } finally {
    fake.restore();
  }
});

Deno.test("recusa: só quem está com a vez, com motivo e logado", async () => {
  const fake = scenario();
  try {
    const caio = await refuse("token-caio", { kind: "return", reason: "Não sou eu" });
    assertEquals(caio.status, 409);
    assertEquals((await caio.json()).error, "nothing_to_refuse");
    const short = await refuse("token-bia", { kind: "return", reason: "ok" });
    assertEquals(short.status, 422);
    assertEquals((await short.json()).error, "refusal_reason_required");
    const anon = await refuse("token-invalido", { kind: "return", reason: "Sem login" });
    assertEquals(anon.status, 401);
    assertEquals(fake.engine.refusals, [], "nenhuma recusa chegou ao motor");
    assertEquals(fake.tables["documents"]![0]!["refusal_kind"], null);
  } finally {
    fake.restore();
  }
});

Deno.test("assinar: quem ainda não tem a vez recebe aviso claro, sem chamar o motor", async () => {
  const fake = scenario();
  fake.tables["document_participants"]![0]!["status"] = "created";
  try {
    const r = await action(
      new Request("http://local/documents-action", {
        method: "POST",
        headers: { authorization: "Bearer token-bia", "content-type": "application/json" },
        body: JSON.stringify({ documentId: "doc-r", action: "sign-url" }),
      }),
    );
    assertEquals(r.status, 409);
    assertEquals((await r.json()).error, "not_your_turn");
    assert(!fake.engineCalls.some((c) => c.includes("action-url")), "o motor não é chamado");
  } finally {
    fake.restore();
  }
});

// ---------- Cancelamento com justificativa obrigatória (18/11/2026) ----------
const cancel = (token: string, body: Record<string, unknown>) =>
  action(
    new Request("http://local/documents-action", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ documentId: "doc-r", action: "cancel", ...body }),
    }),
  );

Deno.test("cancelamento: sem justificativa é recusado e o motor não é chamado", async () => {
  const fake = scenario();
  fake.tables["documents"]![0]!["created_by"] = BIA.id;
  try {
    for (const reason of [undefined, "", "   ", "abc"]) {
      const r = await cancel("token-bia", reason === undefined ? {} : { reason });
      assertEquals(r.status, 400, String(reason));
      assertEquals((await r.json()).error, "cancel_reason_required");
    }
    assert(!fake.engineCalls.some((c) => c.includes("cancellation")));
    assertEquals(fake.tables["documents"]![0]!["status"], "pending");
  } finally {
    fake.restore();
  }
});

Deno.test("cancelamento: a justificativa vai ao motor e aparece na linha do tempo", async () => {
  const fake = scenario();
  fake.tables["documents"]![0]!["created_by"] = BIA.id;
  try {
    const r = await cancel("token-bia", { reason: "  Contrato substituído pela versão 3  " });
    assertEquals(r.status, 200);
    await r.body?.cancel();
    assertEquals(
      fake.engine.documents[ENGINE_ID]!["statusUpdateReason"],
      "Contrato substituído pela versão 3",
    );
    assertEquals(fake.tables["documents"]![0]!["status"], "canceled");
    const ev = (fake.tables["document_events"] ?? []).find(
      (e) => e["type"] === "document.canceled",
    );
    assertEquals(
      (ev?.["data"] as { reason?: string })?.reason,
      "Contrato substituído pela versão 3",
    );
  } finally {
    fake.restore();
  }
});
