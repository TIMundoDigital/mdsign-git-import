// Sincronização com o SignDoc e webhook do motor, com banco e motor simulados (fake_backend.ts).
// O código real de _shared/documents.ts, _shared/engine-events.ts e signdoc-webhook roda sem
// alteração; só o fetch é trocado. Sem rede e sem banco.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

// Os módulos leem a configuração ao serem carregados: define antes de importar.
Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");
Deno.env.set("SIGNDOC_WEBHOOK_TOKEN", Deno.env.get("SIGNDOC_WEBHOOK_TOKEN") || "token-de-teste");
const TOKEN = Deno.env.get("SIGNDOC_WEBHOOK_TOKEN")!;
const { syncDocument } = await import("../functions/_shared/documents.ts");
const { processEngineEvent } = await import("../functions/_shared/engine-events.ts");

// O webhook registra o handler com Deno.serve ao ser importado: captura em vez de abrir porta.
let webhook: (req: Request) => Promise<Response> = () => Promise.reject(new Error("sem handler"));
const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (h: typeof webhook) => {
  webhook = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("../functions/signdoc-webhook/index.ts");
(Deno as unknown as { serve: unknown }).serve = serve;

const ENGINE_ID = "11111111-1111-4111-8111-111111111111";
const DOC = {
  id: "doc-1",
  organization_id: "org-1",
  status: "pending",
  engine_document_id: ENGINE_ID,
};

function scenario() {
  const fake = installFakeBackend({
    tables: {
      documents: [{ ...DOC, kind: "send", own_email: false, verification_key: null }],
      document_participants: [
        // Aprovadora já ligada à ação do motor.
        {
          id: "p-ana",
          document_id: "doc-1",
          organization_id: "org-1",
          name: "Ana",
          email: "ana@ex.com",
          cpf: "11144477735",
          step: 1,
          role: "approver",
          rule_key: null,
          rule_name: null,
          status: "pending",
          engine_flow_action_id: "a1",
        },
        // Signatária sem vínculo: o motor trocou o e-mail pelo do cadastro dele.
        {
          id: "p-bia",
          document_id: "doc-1",
          organization_id: "org-1",
          name: "Bia",
          email: "bia@ex.com",
          cpf: "52998224725",
          step: 2,
          role: "signer",
          rule_key: null,
          rule_name: null,
          status: "created",
          engine_flow_action_id: null,
        },
      ],
    },
    unique: { engine_webhook_events: [["dedupe_key"]] },
  });
  fake.engine.documents[ENGINE_ID] = {
    id: ENGINE_ID,
    name: "Contrato",
    status: "Pending",
    creationDate: "2026-11-17T10:00:00Z",
    updateDate: "2026-11-17T11:00:00Z",
    key: "ABCD-1234",
    flowActions: [
      {
        id: "a1",
        type: "Approver",
        status: "Completed",
        step: 1,
        user: { email: "ana@ex.com", identifier: "11144477735" },
        updateDate: "2026-11-17T11:00:00Z",
      },
      {
        id: "a2",
        type: "Signer",
        status: "Pending",
        step: 2,
        user: { email: "bia.pessoal@ex.com", identifier: "52998224725" },
      },
    ],
  };
  return fake;
}

const events = (fake: ReturnType<typeof scenario>) =>
  (fake.tables["document_events"] ?? []).map((e) => e["type"]);
const person = (fake: ReturnType<typeof scenario>, id: string) =>
  fake.tables["document_participants"]!.find((p) => p["id"] === id)!;

Deno.test("sincronização: aprovação, religação pelo CPF e e-mail do motor", async () => {
  const fake = scenario();
  try {
    const r = await syncDocument({ ...DOC });
    assertEquals(r.status, "pending");
    const ana = person(fake, "p-ana");
    assertEquals(ana["status"], "completed");
    assertEquals(ana["completed_at"], "2026-11-17T11:00:00Z");
    const bia = person(fake, "p-bia");
    assertEquals(bia["engine_flow_action_id"], "a2", "religada pelo CPF");
    assertEquals(bia["email"], "bia.pessoal@ex.com", "passa a mostrar o e-mail usado pelo motor");
    assertEquals(bia["status"], "pending", "chegou a vez dela");
    assertEquals(events(fake), ["participant.approved"]);
    assertEquals(fake.tables["documents"]![0]!["verification_key"], "ABCD-1234");
  } finally {
    fake.restore();
  }
});

Deno.test("sincronização: repetir não duplica eventos", async () => {
  const fake = scenario();
  try {
    await syncDocument({ ...DOC });
    await syncDocument({ ...DOC });
    assertEquals(events(fake), ["participant.approved"]);
  } finally {
    fake.restore();
  }
});

Deno.test("sincronização: documento concluído no motor", async () => {
  const fake = scenario();
  const engine = fake.engine.documents[ENGINE_ID] as {
    status: string;
    updateDate: string;
    flowActions: { status: string; updateDate?: string }[];
  };
  engine.status = "Concluded";
  engine.updateDate = "2026-11-17T12:00:00Z";
  engine.flowActions[1]!.status = "Completed";
  engine.flowActions[1]!.updateDate = "2026-11-17T12:00:00Z";
  try {
    const r = await syncDocument({ ...DOC });
    assertEquals(r.status, "concluded");
    const doc = fake.tables["documents"]![0]!;
    assertEquals(doc["status"], "concluded");
    assertEquals(doc["concluded_at"], "2026-11-17T12:00:00Z");
    assertEquals(events(fake).sort(), [
      "document.concluded",
      "participant.approved",
      "participant.signed",
    ]);
  } finally {
    fake.restore();
  }
});

Deno.test("sincronização: excluído no painel do motor vira cancelado", async () => {
  const fake = scenario();
  fake.engine.deleted.add(ENGINE_ID);
  try {
    const r = await syncDocument({ ...DOC });
    assertEquals(r.status, "canceled");
    assertEquals(fake.tables["documents"]![0]!["status"], "canceled");
    assertEquals(events(fake), ["document.canceled"]);
  } finally {
    fake.restore();
  }
});

Deno.test("evento do motor: processado, ou nova tentativa agendada em erro", async () => {
  const fake = scenario();
  fake.tables["engine_webhook_events"] = [
    { id: 1, type: "DocumentSigned", attempts: 0, processed_at: null },
    { id: 2, type: "DocumentSigned", attempts: 0, processed_at: null },
  ];
  // Documento existe no MDSign, mas o motor não responde por ele: erro e nova tentativa.
  fake.tables["documents"]!.push({
    ...DOC,
    id: "doc-2",
    engine_document_id: "22222222-2222-4222-8222-222222222222",
  });
  try {
    assert(
      await processEngineEvent({
        id: 1,
        type: "DocumentSigned",
        attempts: 0,
        payload: { data: { id: ENGINE_ID } },
      }),
    );
    const ok = fake.tables["engine_webhook_events"]!.find((e) => e["id"] === 1)!;
    assert(ok["processed_at"], "evento processado");

    assert(
      !(await processEngineEvent({
        id: 2,
        type: "DocumentSigned",
        attempts: 0,
        payload: { data: { id: "22222222-2222-4222-8222-222222222222" } },
      })),
    );
    const failed = fake.tables["engine_webhook_events"]!.find((e) => e["id"] === 2)!;
    assertEquals(failed["processed_at"], null);
    assertEquals(failed["attempts"], 1);
    assert(failed["next_attempt_at"], "nova tentativa agendada");
    assert((fake.tables["engine_errors"] ?? []).length > 0, "erro do motor registrado");
  } finally {
    fake.restore();
  }
});

Deno.test("webhook do motor: token, registro e aviso repetido", async () => {
  const fake = scenario();
  const post = (token: string | null, body: unknown) =>
    webhook(
      new Request("http://local/signdoc-webhook", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
    );
  const aviso = {
    type: "DocumentSigned",
    data: { id: ENGINE_ID, updateDate: "2026-11-17T11:00:00Z" },
  };
  try {
    assertEquals((await post(null, aviso)).status, 401, "sem token");
    assertEquals((await post("errado", aviso)).status, 401, "token errado");
    assertEquals(fake.tables["engine_webhook_events"] ?? [], [], "nada registrado sem token");

    assertEquals((await post(TOKEN, aviso)).status, 200);
    assertEquals(fake.tables["engine_webhook_events"]!.length, 1);
    assert(fake.tables["engine_webhook_events"]![0]!["processed_at"], "processado na hora");
    assertEquals(person(fake, "p-ana")["status"], "completed", "estado lido da API do motor");

    // O Signer reenvia o mesmo aviso: confirma sem registrar nem processar de novo.
    const calls = fake.engineCalls.length;
    assertEquals((await post(TOKEN, aviso)).status, 200);
    assertEquals(fake.tables["engine_webhook_events"]!.length, 1);
    assertEquals(fake.engineCalls.length, calls, "não consulta o motor de novo");
  } finally {
    fake.restore();
  }
});
