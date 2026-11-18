import { describe, expect, it } from "vitest";
import { planText } from "@/app/plan-texts";

describe("planText", () => {
  it("traduz os textos publicados", () => {
    expect(planText("Até 4 usuários", "en")).toBe("Up to 4 users");
    expect(planText("Para profissionais.", "es")).toBe("Para profesionales.");
  });
  it("mantém o português e textos que mudaram no Super Admin", () => {
    expect(planText("Até 4 usuários", "pt")).toBe("Até 4 usuários");
    expect(planText("Texto novo do admin", "en")).toBe("Texto novo do admin");
  });
});
