import { describe, expect, it } from "vitest";
import { databaseUrlIndicatesTls } from "../../src/platform/health/database-url-tls";

describe("databaseUrlIndicatesTls", () => {
  it("detecta sslmode=require", () => {
    expect(databaseUrlIndicatesTls("postgres://u:p@h:5432/db?sslmode=require")).toBe(true);
  });

  it("detecta sslmode=verify-full", () => {
    expect(databaseUrlIndicatesTls("postgres://u:p@h/db?x=1&sslmode=verify-full")).toBe(true);
  });

  it("detecta ssl=true na query", () => {
    expect(databaseUrlIndicatesTls("postgres://u:p@h/db?ssl=true")).toBe(true);
  });

  it("falha sem indicacao de TLS", () => {
    expect(databaseUrlIndicatesTls("postgres://u:p@localhost:5432/cobranca")).toBe(false);
  });
});
