import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

const navItems = [
  { to: "/admin/model", label: "Model Portföy", icon: "🧮" },
  { to: "/admin/profiller", label: "Risk Profilleri", icon: "🗂️" },
  { to: "/admin/senkronizasyon", label: "TEFAS Senkronizasyonu", icon: "🔄" },
];

export function AdminLayout() {
  const { loading, session, isAdmin, signOut } = useAdminAuth();

  if (loading) {
    return (
      <div className="app-main">
        <p className="page-subtitle">Yükleniyor…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/giris" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="app-main">
        <div className="card" style={{ maxWidth: 480 }}>
          <p className="page-title">Yetkiniz yok</p>
          <p className="page-subtitle">
            Bu hesap giriş yapmış ama yönetim yetkisi (admin_users) tanımlı değil. Lütfen sistem
            yöneticinizle iletişime geçin.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => signOut()}>
            Çıkış yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar desktop-only">
        <div className="brand">
          <span className="brand-mark">FP</span>
          <span>Fon Portföy Admin</span>
        </div>
        <nav>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ marginTop: "auto" }} className="stack-sm">
          <NavLink to="/" className="nav-link">
            <span aria-hidden="true">🏠</span>
            Kullanıcı uygulaması
          </NavLink>
          <div className="row-between">
            <span className="disclaimer">{session.user.email}</span>
          </div>
          <button className="btn btn-secondary btn-sm btn-block" onClick={() => signOut()}>
            Çıkış yap
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="app-topbar mobile-only">
          <div className="brand">
            <span className="brand-mark">FP</span>
            <span>Fon Portföy Admin</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
            Çıkış
          </button>
        </header>
        <main className="app-main" style={{ paddingBottom: "var(--space-7)" }}>
          <nav className="row mobile-only" style={{ marginBottom: 16, overflowX: "auto" }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `badge${isActive ? " badge-mint" : ""}`}
                style={{ textDecoration: "none" }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
