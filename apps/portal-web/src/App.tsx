import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { AppShell } from "./layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CobrancasPage } from "./pages/CobrancasPage";
import { NotasFiscaisPage } from "./pages/NotasFiscaisPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ClienteFormPage } from "./pages/ClienteFormPage";
import { ClienteDetalhePage } from "./pages/ClienteDetalhePage";
import { CobrancaFormPage } from "./pages/CobrancaFormPage";
import { EscritorioPage } from "./pages/EscritorioPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { AjudaProvisionamentoCorePage } from "./pages/AjudaProvisionamentoCorePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ClienteEditPage } from "./pages/ClienteEditPage";
import { BoletoDetalhePage } from "./pages/BoletoDetalhePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/notas-fiscais" element={<NotasFiscaisPage />} />
                <Route path="/cobrancas" element={<CobrancasPage />} />
                <Route path="/cobrancas/nova" element={<CobrancaFormPage />} />
                <Route path="/cobrancas/:chargeId" element={<BoletoDetalhePage />} />
                <Route path="/relatorios" element={<RelatoriosPage />} />
                <Route path="/escritorio" element={<EscritorioPage />} />
                <Route path="/ajuda/provisionamento-core" element={<AjudaProvisionamentoCorePage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/clientes/novo" element={<ClienteFormPage />} />
                <Route path="/clientes/:id/editar" element={<ClienteEditPage />} />
                <Route path="/clientes/:id" element={<ClienteDetalhePage />} />
                <Route
                  path="/recorrente"
                  element={
                    <PlaceholderPage
                      title="Cobrança recorrente"
                      description="Agendamentos, planos e faturamento automático em evolução no roadmap."
                    />
                  }
                />
                <Route
                  path="/notificacoes"
                  element={
                    <PlaceholderPage
                      title="Notificações"
                      description="Central de e-mail, WhatsApp e lembretes operacionais."
                    />
                  }
                />
                <Route
                  path="/auditoria"
                  element={
                    <PlaceholderPage
                      title="Auditoria"
                      description="Trilha de eventos e exportações para conformidade."
                    />
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <PlaceholderPage
                      title="Configurações"
                      description="Preferências do escritório, integrações e papéis de acesso."
                    />
                  }
                />
              </Route>
            </Route>
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
