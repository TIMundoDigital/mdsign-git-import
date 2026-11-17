// Liga cada participante do MDSign à ação correspondente no motor (SignDoc).
//
// O motor identifica a pessoa pelo CPF e pode trocar o e-mail informado pelo do cadastro que já
// existe nele. Comparar só o e-mail deixava o participante sem vínculo (engine_flow_action_id
// nulo): a sincronização o ignorava, o lembrete falhava e a edição travava (auditoria D-05).
//
// Ordem de tentativa, sempre dentro da mesma etapa:
//   1. e-mail;
//   2. CPF (identifier do motor, só dígitos);
//   3. posição: as ações que sobraram, do mesmo tipo, na ordem em que o motor as devolve
//      (é a ordem de envio).
// Grupos com quórum viram uma única regra no motor: todos os membros apontam para ela, achada
// pelo e-mail ou CPF de um membro ou pelo nome do grupo.

import type { EngineFlowAction } from "./signdoc.ts";

export type LinkPerson = {
  email: string;
  cpf?: string | null;
  step: number;
  role: string;
  rule?: { key?: string | null; name?: string | null } | null;
};

const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");
const lower = (v: string | null | undefined) =>
  String(v ?? "")
    .trim()
    .toLowerCase();
const isRuleAction = (a: EngineFlowAction) => a.type === "SignRule" || a.type === "ApproverRule";
const members = (a: EngineFlowAction) => a.ruleUsers ?? a.signRuleUsers ?? [];
const wantedType = (p: LinkPerson) =>
  p.rule
    ? p.role === "approver"
      ? "ApproverRule"
      : "SignRule"
    : p.role === "approver"
      ? "Approver"
      : "Signer";

/**
 * Devolve, para cada pessoa (mesma ordem), a ação do motor correspondente ou `undefined`.
 * `taken`: ids de ações individuais que já pertencem a outro participante e não podem ser
 * reaproveitados (ex.: na edição e na religação durante a sincronização).
 * `byPosition: false` desliga a 3ª tentativa: na edição, quem já estava no documento sem vínculo
 * poderia perder a própria ação para um participante novo; a sincronização religa depois,
 * olhando todos juntos.
 */
export function linkParticipants(
  people: LinkPerson[],
  actions: EngineFlowAction[],
  taken: Iterable<string> = [],
  { byPosition = true }: { byPosition?: boolean } = {},
): (EngineFlowAction | undefined)[] {
  const used = new Set(taken);
  const result: (EngineFlowAction | undefined)[] = people.map(() => undefined);
  const free = (a: EngineFlowAction) => !isRuleAction(a) && !used.has(a.id);
  const claim = (i: number, a: EngineFlowAction | undefined) => {
    if (!a) return;
    result[i] = a;
    if (!isRuleAction(a)) used.add(a.id);
  };

  // Grupos com quórum: a regra da mesma etapa e do mesmo tipo que tenha a pessoa ou o nome.
  people.forEach((p, i) => {
    if (!p.rule) return;
    const cpf = digits(p.cpf);
    const candidates = actions.filter((a) => a.type === wantedType(p) && a.step === p.step);
    claim(
      i,
      candidates.find((a) =>
        members(a).some((u) => lower(u.email) === p.email || (cpf && digits(u.identifier) === cpf)),
      ) ??
        candidates.find((a) => p.rule?.name && lower(a.ruleName) === lower(p.rule.name)) ??
        (candidates.length === 1 ? candidates[0] : undefined),
    );
  });

  const singles = people.map((p, i) => ({ p, i })).filter(({ p }) => !p.rule);
  const pass = (match: (p: LinkPerson, a: EngineFlowAction) => boolean) => {
    for (const { p, i } of singles) {
      if (result[i]) continue;
      claim(
        i,
        actions.find((a) => free(a) && a.step === p.step && match(p, a)),
      );
    }
  };
  pass((p, a) => lower(a.user?.email) === p.email);
  pass((p, a) => {
    const cpf = digits(p.cpf);
    return cpf.length > 0 && digits(a.user?.identifier) === cpf;
  });
  if (byPosition) pass((p, a) => a.type === wantedType(p));
  return result;
}
