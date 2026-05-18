import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../hooks/useAuth";
import { LoginPage } from "./LoginPage";
import { clearSession } from "../lib/api";

function renderLogin(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    clearSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            access_token: "jwt-test",
            token_type: "Bearer",
            expires_in: 900
          })
      })
    );
  });

  it("submete email, tenant_id e password para /v1/portal/auth/login", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/E-mail/i), "portal@test.dev");
    await user.type(screen.getByLabelText(/Tenant/i), "1");
    await user.type(screen.getByLabelText(/^Senha$/i), "secret");
    await user.click(screen.getByRole("button", { name: /Entrar/i }));
    expect(fetch).toHaveBeenCalled();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/auth/login");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "portal@test.dev", tenant_id: "1", password: "secret" }));
  });
});
