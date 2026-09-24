import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[];
}

// SDD-08 — navegación por rol (nicety de UX; el backend igual aplica
// requireRole en cada endpoint, ver SDD-11 §2). Antes era una barra
// horizontal; ahora es una barra lateral fija, pero el filtrado por rol es
// exactamente el mismo (mismos `data-testid` que antes para no romper
// Cypress).
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: "home", roles: ["admin", "operario", "dueño"] },
  { to: "/ingredientes", label: "Ingredientes", icon: "nutrition", roles: ["admin", "dueño"] },
  { to: "/recetas", label: "Recetas", icon: "menu_book", roles: ["admin", "dueño", "operario"] },
  { to: "/calculadora-costos", label: "Calculadora de Costos", icon: "calculate", roles: ["admin", "dueño", "operario"] },
  { to: "/lotes/producir", label: "Producir Lote", icon: "local_fire_department", roles: ["admin", "operario", "dueño"] },
  { to: "/ventas/registrar", label: "Registrar Venta", icon: "point_of_sale", roles: ["admin", "operario", "dueño"] },
  { to: "/inventario", label: "Inventario", icon: "inventory_2", roles: ["admin", "dueño", "operario"] },
  { to: "/reportes", label: "Reportes", icon: "monitoring", roles: ["admin", "dueño"] },
  { to: "/categorias", label: "Categorías", icon: "category", roles: ["admin"] },
  { to: "/proveedores", label: "Proveedores", icon: "local_shipping", roles: ["admin"] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        data-testid="app-sidebar"
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon name="bakery_dining" size={22} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Panadería</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`nav-${item.to === "/" ? "home" : item.to.replace(/^\//, "").replace(/\//g, "-")}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={20} />
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>

          <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/40 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              <Icon name="person" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs capitalize text-sidebar-muted">{user.role}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            data-testid="logout-button"
            className="justify-center gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Icon name="logout" size={18} />
            Cerrar sesión
          </Button>
          <NavLink
            to="/acerca-de"
            data-testid="nav-about"
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center gap-1.5 text-[11px] text-sidebar-muted transition-colors hover:text-sidebar-accent-foreground",
                isActive && "text-sidebar-accent-foreground",
              )
            }
          >
            <Icon name="info" size={14} />
            Acerca de
          </NavLink>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-1 flex-col overflow-x-auto">
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          <div key={location.pathname} className="anim-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
