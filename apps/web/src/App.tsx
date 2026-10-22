import { Route, Routes } from "react-router";
import { PublicLayout } from "./components/layout";
import { ManagePage } from "./pages/manage";
import { PrivacyPage } from "./pages/privacy";
import { ReservePage } from "./pages/reserve";
import { AgendaPage } from "./staff/agenda";
import { StaffLayout } from "./staff/layout";
import { LoginPage } from "./staff/login";
import { StatsPage } from "./staff/stats";
import { TablesPage } from "./staff/tables";

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<ReservePage />} />
        <Route path="reserva/:token" element={<ManagePage />} />
        <Route path="privacidade" element={<PrivacyPage />} />
      </Route>

      <Route path="equipe/login" element={<LoginPage />} />
      <Route path="equipe" element={<StaffLayout />}>
        <Route index element={<AgendaPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="painel" element={<StatsPage />} />
      </Route>

      <Route path="*" element={<PublicLayout />}>
        <Route
          index
          element={<p className="text-muted-foreground p-12 text-center">Página não encontrada.</p>}
        />
      </Route>
    </Routes>
  );
}
