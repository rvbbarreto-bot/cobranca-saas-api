import { describe, expect, it } from "vitest";
import {
  parseSerproProcuradorToken,
  parseSerproProcuradorTokenFromEtag
} from "../../src/modules/serpro-integra-contador/domain/serpro-procurador-token";

describe("parseSerproProcuradorToken", () => {
  it("extrai token de dados objeto", () => {
    const parsed = parseSerproProcuradorToken({
      dados: {
        autenticar_procurador_token: "abc-123",
        data_hora_expiracao: "2026-06-15T12:00:00"
      }
    });
    expect(parsed?.token).toBe("abc-123");
    expect(parsed?.expiresAt).toBe("2026-06-15T12:00:00");
  });

  it("extrai token de dados JSON string", () => {
    const parsed = parseSerproProcuradorToken({
      dados: JSON.stringify({ autenticar_procurador_token: "xyz-789" })
    });
    expect(parsed?.token).toBe("xyz-789");
  });

  it("retorna null sem token", () => {
    expect(parseSerproProcuradorToken({ dados: {} })).toBeNull();
    expect(parseSerproProcuradorToken(null)).toBeNull();
  });
});

describe("parseSerproProcuradorTokenFromEtag", () => {
  it("extrai token do etag SERPRO", () => {
    const token = parseSerproProcuradorTokenFromEtag(
      '"autenticar_procurador_token:550e8400-e29b-41d4-a716-446655440000"'
    );
    expect(token).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("suporta weak etag", () => {
    const token = parseSerproProcuradorTokenFromEtag(
      'W/"autenticar_procurador_token:token-id"'
    );
    expect(token).toBe("token-id");
  });
});
