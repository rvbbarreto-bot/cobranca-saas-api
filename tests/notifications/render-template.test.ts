import { describe, expect, it } from "vitest";
import { renderTemplate } from "../../src/modules/notifications/application/render-template";

describe("renderTemplate", () => {
  it("substitui {{nome}} e {{valor}} corretamente", () => {
    const out = renderTemplate("Ola {{nome}}, valor {{valor}}.", {
      nome: "Ana",
      valor: "R$ 10,00"
    });
    expect(out).toBe("Ola Ana, valor R$ 10,00.");
  });

  it("variavel ausente → string vazia sem erro", () => {
    expect(renderTemplate("{{x}}", {})).toBe("");
  });
});
