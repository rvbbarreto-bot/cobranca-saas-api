import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../hooks/useAuth";
import { ExeqAuthProvider } from "../hooks/useExeqAuth";
import { LoginPage } from "./LoginPage";
import { clearSession } from "../lib/api";
import { clearExeqSession } from "../lib/exeq-api";

function renderLogin(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <ExeqAuthProvider>
            <LoginPage />
          </ExeqAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    clearSession();
    clearExeqSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            login_kind: "portal",
            access_token: "jwt-test",
            token_type: "Bearer",
            expires_in: 900,
            tenant_id: "1"
          })
      })
    );
  });

  it("submete email e password sem tenant obrigatorio", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/^E-mail$/i), "portal@test.dev");
    await user.type(screen.getByLabelText(/^Senha$/i), "secret");
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));
    expect(fetch).toHaveBeenCalled();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/auth/login");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "portal@test.dev", password: "secret" }));
  });
});
