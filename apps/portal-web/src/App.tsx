import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { PortalRoleGuard } from "./components/PortalRoleGuard";
import { AppShell } from "./layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CobrancasPage } from "./pages/CobrancasPage";
import { NotasFiscaisPage } from "./pages/NotasFiscaisPage";
import { GuiasFiscaisPage } from "./pages/GuiasFiscaisPage";
import { GuiaFiscalDetalhePage } from "./pages/GuiaFiscalDetalhePage";
import { ProcessamentosFiscaisPage } from "./pages/ProcessamentosFiscaisPage";
import { FiscalDashboardPage } from "./pages/FiscalDashboardPage";
import { ProcessamentoDetalhePage } from "./pages/ProcessamentoDetalhePage";
import { ImportPgdasdPage } from "./pages/ImportPgdasdPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ClienteFormPage } from "./pages/ClienteFormPage";
import { ClienteDetalhePage } from "./pages/ClienteDetalhePage";
import { CobrancaFormPage } from "./pages/CobrancaFormPage";
import { EscritorioPage } from "./pages/EscritorioPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { AjudaProvisionamentoCorePage } from "./pages/AjudaProvisionamentoCorePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ConfiguracoesPage } from "./pages/ConfiguracoesPage";
import { ConfigFiscalPage } from "./pages/ConfigFiscalPage";
import { FiscalCertificadosPage } from "./pages/FiscalCertificadosPage";
import { FiscalProcuracoesPage } from "./pages/FiscalProcuracoesPage";
import { FiscalConexaoReceitaPage } from "./pages/FiscalConexaoReceitaPage";
import { FiscalAuditoriaPage } from "./pages/FiscalAuditoriaPage";
import { ClienteEditPage } from "./pages/ClienteEditPage";
import { BoletoDetalhePage } from "./pages/BoletoDetalhePage";
import { CobrancaEditPage } from "./pages/CobrancaEditPage";
import { ClienteAcessoPage } from "./pages/ClienteAcessoPage";
import { ClienteCobrancasPage } from "./pages/ClienteCobrancasPage";
import { ClienteCobrancaDetalhePage } from "./pages/ClienteCobrancaDetalhePage";
import { ClienteProtectedRoute } from "./components/ClienteProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import { ExeqAuthProvider } from "./hooks/useExeqAuth";
import { ExeqProtectedRoute } from "./components/ExeqProtectedRoute";
import { ExeqShell } from "./layout/ExeqShell";
import { ExeqLoginPage } from "./pages/ExeqLoginPage";
import { ExeqEscritoriosPage } from "./pages/ExeqEscritoriosPage";
import { ExeqEscritorioNovoPage } from "./pages/ExeqEscritorioNovoPage";
import { ExeqEscritorioDetailPage } from "./pages/ExeqEscritorioDetailPage";

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
      <ToastProvider>
        <AuthProvider>
          <ExeqAuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/exeq/login" element={<ExeqLoginPage />} />
            <Route element={<ExeqProtectedRoute />}>
              <Route element={<ExeqShell />}>
                <Route path="/exeq" element={<ExeqEscritoriosPage />} />
                <Route path="/exeq/escritorios" element={<ExeqEscritoriosPage />} />
                <Route path="/exeq/escritorios/novo" element={<ExeqEscritorioNovoPage />} />
                <Route path="/exeq/escritorios/:escritorioId" element={<ExeqEscritorioDetailPage />} />
              </Route>
            </Route>
            <Route path="/acesso" element={<ClienteAcessoPage />} />
            <Route element={<ClienteProtectedRoute />}>
              <Route path="/cliente/cobrancas" element={<ClienteCobrancasPage />} />
              <Route path="/cliente/cobrancas/:chargeId" element={<ClienteCobrancaDetalhePage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route element={<PortalRoleGuard />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/notas-fiscais" element={<NotasFiscaisPage />} />
                <Route path="/guias-fiscais" element={<GuiasFiscaisPage />} />
                <Route path="/guias-fiscais/:guiaId" element={<GuiaFiscalDetalhePage />} />
                <Route path="/fiscal/dashboard" element={<FiscalDashboardPage />} />
                <Route path="/fiscal" element={<FiscalDashboardPage />} />
                <Route path="/processamentos-fiscais" element={<ProcessamentosFiscaisPage />} />
                <Route path="/processamentos-fiscais/importar" element={<ImportPgdasdPage />} />
                <Route path="/processamentos-fiscais/:processamentoId" element={<ProcessamentoDetalhePage />} />
                <Route path="/cobrancas" element={<CobrancasPage />} />
                <Route path="/cobrancas/nova" element={<CobrancaFormPage />} />
                <Route path="/cobrancas/:chargeId/editar" element={<CobrancaEditPage />} />
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
                  element={<FiscalAuditoriaPage />}
                />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="/configuracoes/fiscal" element={<ConfigFiscalPage />} />
                <Route path="/configuracoes/fiscal/conexao-receita" element={<FiscalConexaoReceitaPage />} />
                <Route path="/fiscal/certificados" element={<FiscalCertificadosPage />} />
                <Route path="/fiscal/procuracoes" element={<FiscalProcuracoesPage />} />
                <Route path="/fiscal/auditoria" element={<FiscalAuditoriaPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </BrowserRouter>
          </ExeqAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
