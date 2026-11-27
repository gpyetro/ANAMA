import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  ONG: "Organização",
  FAMILIA: "Família",
  DOADOR: "Doador",
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const icons = {
  home: (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  building: (
    <Icon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
    </Icon>
  ),
  bell: (
    <Icon>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </Icon>
  ),
  user: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  ),
};

function initials(name?: string) {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "A";
}

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/">
          <img className="brand-logo" src="/favicon.svg" alt="" />
          <span>
            ANAMÃ
            <small>Cestas Solidárias</small>
          </span>
        </Link>

        <nav className="bottom-navigation" aria-label="Navegação principal">
          <NavLink to="/" end>
            {icons.home}
            Início
          </NavLink>

          {user?.tipo === "ADMIN" && (
            <NavLink to="/admin/organizations">
              {icons.shield}
              ONGs
            </NavLink>
          )}
          {user?.tipo === "ONG" && (
            <NavLink to="/organization">
              {icons.building}
              Gestão ONG
            </NavLink>
          )}
          <NavLink to="/notifications">
            {icons.bell}
            Avisos
          </NavLink>
          <NavLink to="/profile">
            {icons.user}
            Perfil
          </NavLink>
        </nav>

        <div className="header-user">
          <div className="user-chip">
            <span className="user-avatar" aria-hidden="true">
              {initials(user?.nome)}
            </span>
            <span className="user-meta">
              <strong>{user?.nome}</strong>
              <span>{user?.tipo ? ROLE_LABEL[user.tipo] ?? user.tipo : ""}</span>
            </span>
          </div>

          <button type="button" className="text-button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
