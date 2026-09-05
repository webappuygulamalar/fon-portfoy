import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { UserLayout } from "./components/layout/UserLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { CalculatorPage } from "./pages/user/CalculatorPage";
import { FundsPage } from "./pages/user/FundsPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminModelEditorPage } from "./pages/admin/AdminModelEditorPage";
import { AdminProfilesPage } from "./pages/admin/AdminProfilesPage";
import { AdminSyncPage } from "./pages/admin/AdminSyncPage";

export default function App() {
  return (
    <AdminAuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<UserLayout />}>
            <Route index element={<CalculatorPage />} />
            <Route path="fonlar" element={<FundsPage />} />
          </Route>

          <Route path="admin/giris" element={<AdminLoginPage />} />

          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="model" replace />} />
            <Route path="model" element={<AdminModelEditorPage />} />
            <Route path="profiller" element={<AdminProfilesPage />} />
            <Route path="senkronizasyon" element={<AdminSyncPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AdminAuthProvider>
  );
}
