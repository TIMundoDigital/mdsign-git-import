// Ligação participante × ação do motor (auditoria D-05). Sem rede e sem banco.
// Rodar como os demais testes Deno: numa cópia da pasta supabase, fora da raiz do repositório.
import { assertEquals } from "jsr:@std/assert@1";
import { linkParticipants, type LinkPerson } from "../functions/_shared/engine-link.ts";
import { editDuplicates } from "../functions/_shared/participants.ts";
import type { EngineFlowAction } from "../functions/_shared/signdoc.ts";

const action = (
  id: string,
  type: EngineFlowAction["type"],
  step: number,
  user?: { email?: string; identifier?: string },
  extra: Partial<EngineFlowAction> = {},
): EngineFlowAction => ({ id, type, step, status: "Pending", ...(user ? { user } : {}), ...extra });

const ids = (links: (EngineFlowAction | undefined)[]) => links.map((a) => a?.id ?? null);

Deno.test("motor: liga pelo e-mail dentro da mesma etapa", () => {
  const people: LinkPerson[] = [
    { email: "ana@ex.com", cpf: "11144477735", step: 1, role: "approver" },
    { email: "bia@ex.com", cpf: "52998224725", step: 2, role: "signer" },
  ];
  const actions = [
    action("a2", "Signer", 2, { email: "bia@ex.com", identifier: "52998224725" }),
    action("a1", "Approver", 1, { email: "ana@ex.com", identifier: "11144477735" }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["a1", "a2"]);
});

Deno.test("motor: e-mail trocado pelo motor ainda liga pelo CPF", () => {
  const people: LinkPerson[] = [
    { email: "ana@empresa.com", cpf: "111.444.777-35", step: 1, role: "signer" },
    { email: "bia@empresa.com", cpf: "52998224725", step: 1, role: "signer" },
  ];
  // O motor usa o e-mail do cadastro dele e devolve as ações em outra ordem.
  const actions = [
    action("b", "Signer", 1, { email: "bia.pessoal@ex.com", identifier: "529.982.247-25" }),
    action("a", "Signer", 1, { email: "ana.pessoal@ex.com", identifier: "11144477735" }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["a", "b"]);
});

Deno.test("motor: sem e-mail nem CPF, liga pela posição na etapa e pelo tipo", () => {
  const people: LinkPerson[] = [
    { email: "x@ex.com", cpf: null, step: 1, role: "approver" },
    { email: "y@ex.com", cpf: null, step: 2, role: "signer" },
    { email: "z@ex.com", cpf: null, step: 2, role: "witness" },
  ];
  const actions = [
    action("ap", "Approver", 1, { email: "outro@ex.com" }),
    action("s1", "Signer", 2, { email: "outro2@ex.com" }),
    action("s2", "Signer", 2, { email: "outro3@ex.com" }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["ap", "s1", "s2"]);
});

Deno.test("motor: nunca liga a uma etapa diferente nem a ação já ocupada", () => {
  const people: LinkPerson[] = [{ email: "novo@ex.com", cpf: null, step: 3, role: "signer" }];
  const actions = [
    action("antiga", "Signer", 2, { email: "novo@ex.com" }),
    action("ocupada", "Signer", 3, { email: "quem@ex.com" }),
  ];
  assertEquals(ids(linkParticipants(people, actions, ["ocupada"])), [null]);
  // Sem a ação ocupada, a posição na etapa resolve.
  assertEquals(ids(linkParticipants(people, actions)), ["ocupada"]);
  // Na edição, sem a posição: não toma a ação de outra pessoa.
  assertEquals(ids(linkParticipants(people, actions, [], { byPosition: false })), [null]);
});

Deno.test("motor: a correspondência exata vence a posição", () => {
  // O primeiro não casa por e-mail nem CPF; o segundo casa pelo e-mail com a 1ª ação.
  const people: LinkPerson[] = [
    { email: "sem@ex.com", cpf: null, step: 1, role: "signer" },
    { email: "bia@ex.com", cpf: null, step: 1, role: "signer" },
  ];
  const actions = [
    action("bia", "Signer", 1, { email: "bia@ex.com" }),
    action("outra", "Signer", 1, { email: "trocado@ex.com" }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["outra", "bia"]);
});

Deno.test("motor: membros de um grupo com quórum apontam para a mesma regra", () => {
  const rule = { key: "g1", name: "Diretoria" };
  const people: LinkPerson[] = [
    { email: "d1@ex.com", cpf: "11144477735", step: 2, role: "signer", rule },
    { email: "d2@ex.com", cpf: "52998224725", step: 2, role: "signer", rule },
    { email: "fin@ex.com", cpf: null, step: 2, role: "signer" },
  ];
  const actions = [
    action("fin", "Signer", 2, { email: "fin@ex.com" }),
    action("regra", "SignRule", 2, undefined, {
      ruleName: "Diretoria",
      ruleUsers: [
        { email: "trocado@ex.com", identifier: "11144477735" },
        { email: "d2@ex.com", identifier: "52998224725" },
      ],
    }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["regra", "regra", "fin"]);
});

Deno.test("motor: grupo achado pelo nome quando ninguém casa por e-mail ou CPF", () => {
  const people: LinkPerson[] = [
    {
      email: "a@ex.com",
      cpf: null,
      step: 1,
      role: "approver",
      rule: { key: "x", name: "Jurídico" },
    },
  ];
  const actions = [
    action("r1", "ApproverRule", 1, undefined, { ruleName: "Comercial", ruleUsers: [] }),
    action("r2", "ApproverRule", 1, undefined, { ruleName: "Jurídico", ruleUsers: [] }),
  ];
  assertEquals(ids(linkParticipants(people, actions)), ["r2"]);
});

Deno.test("edição: ninguém entra duas vezes no documento", () => {
  const current = [
    { id: "p1", email: "ana@ex.com" },
    { id: "p2", email: "bia@ex.com" },
  ];
  // Incluir quem já está: recusado.
  assertEquals(editDuplicates(current, [], [], [{ email: "ana@ex.com" }]).duplicates, [
    { index: 0, field: "duplicate" },
  ]);
  // Quem saiu pode voltar na mesma edição.
  assertEquals(editDuplicates(current, ["p1"], [], [{ email: "ana@ex.com" }]).duplicates, []);
  // Trocar o e-mail de alguém para o de outra pessoa do documento: recusado.
  assertEquals(
    editDuplicates(current, [], [{ participantId: "p2", email: " ANA@ex.com " }], []).duplicates,
    [{ index: -1, field: "duplicate" }],
  );
  // O e-mail antigo de quem foi editado fica livre para um novo participante.
  assertEquals(
    editDuplicates(
      current,
      [],
      [{ participantId: "p2", email: "bia2@ex.com" }],
      [{ email: "bia@ex.com" }],
    ).duplicates,
    [],
  );
});
