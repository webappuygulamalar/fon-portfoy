import { NavLink, Outlet } from "react-router-dom";
import { HesaplamaPastaIcon } from "../ui/HesaplamaPastaIcon";
import { FonlarMadeniParaIcon } from "../ui/FonlarMadeniParaIcon";

const navItems = [
  { to: "/", label: "Hesaplama", Icon: HesaplamaPastaIcon, end: true },
  { to: "/fonlar", label: "Fonlar", Icon: FonlarMadeniParaIcon, end: false },
];

export function UserLayout() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar desktop-only">
        <div className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
            alt="Fon Portföy simgesi: model portföy dağılımını gösteren pasta grafiği"
            width={32}
            height={32}
          />
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
                  <item.Icon className="nav-link-icon" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="app-topbar mobile-only">
          <div className="brand">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
              alt="Fon Portföy simgesi: model portföy dağılımını gösteren pasta grafiği"
              width={32}
              height={32}
            />
            <span>Fon Portföy</span>
          </div>
        </header>

        <nav className="mobile-tabbar mobile-only" aria-label="Ana gezinme">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-tabbar-item${isActive ? " active" : ""}`}
            >
              <item.Icon className="mobile-tabbar-icon" />
              <span className="mobile-tabbar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
