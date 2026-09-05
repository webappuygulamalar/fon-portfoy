import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Hesaplama", icon: "📊", end: true },
  { to: "/fonlar", label: "Fonlar", icon: "📁", end: false },
];

export function UserLayout() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar desktop-only">
        <div className="brand">
          <span className="brand-mark">FP</span>
          <span>Fon Portföy</span>
        </div>
        <nav>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ marginTop: "auto" }}>
          <NavLink to="/admin" className="nav-link">
            <span aria-hidden="true">🔒</span>
            Yönetim
          </NavLink>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="app-topbar mobile-only">
          <div className="brand">
            <span className="brand-mark">FP</span>
            <span>Fon Portföy</span>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>

        <nav className="mobile-tabbar mobile-only" aria-label="Ana gezinme">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-tabbar-item${isActive ? " active" : ""}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
