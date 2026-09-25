import * as React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Batch, Ingredient, Paginated, ProfitabilityReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExchangeRateCard } from "@/components/ExchangeRateCard";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

// SDD-08 §8 — un solo componente de dashboard con mapeo rol -> tarjetas a
// mostrar. A propósito NO se hacen 3 páginas separadas (indicación
// explícita del usuario de mantener esto simple).
interface ShortcutCard {
  to: string;
  title: string;
  description: string;
  icon: string;
  big?: boolean;
}

const SHORTCUTS_BY_ROLE: Record<string, ShortcutCard[]> = {
  admin: [
    { to: "/calculadora-costos", title: "Calculadora de Costos", description: "Explora el costo de cualquier receta sin producir nada.", icon: "calculate" },
    { to: "/ingredientes", title: "Ingredientes", description: "Ver y editar ingredientes, precios y stock.", icon: "nutrition" },
    { to: "/recetas", title: "Recetas", description: "Crear y editar recetas y sub-recetas.", icon: "menu_book" },
    { to: "/lotes/producir", title: "Producir Lote", description: "Registrar una nueva producción.", icon: "local_fire_department" },
    { to: "/ventas/registrar", title: "Registrar Venta", description: "Registrar una venta de un producto.", icon: "point_of_sale" },
    { to: "/categorias", title: "Categorías", description: "Administrar categorías de ingredientes y recetas.", icon: "category" },
    { to: "/proveedores", title: "Proveedores", description: "Administrar proveedores de ingredientes.", icon: "local_shipping" },
  ],
  operario: [
    { to: "/lotes/producir", title: "Producir Lote", description: "Registrar una nueva producción.", icon: "local_fire_department", big: true },
    { to: "/ventas/registrar", title: "Registrar Venta", description: "Registrar una venta de un producto.", icon: "point_of_sale", big: true },
    { to: "/calculadora-costos", title: "Calculadora de Costos", description: "Explora el costo de cualquier receta sin producir nada.", icon: "calculate" },
  ],
  dueño: [
    { to: "/calculadora-costos", title: "Calculadora de Costos", description: "Explora el costo de cualquier receta sin producir nada.", icon: "calculate" },
    { to: "/reportes", title: "Reportes", description: "Rentabilidad, producción y costos.", icon: "monitoring" },
    { to: "/ingredientes", title: "Ingredientes", description: "Ver y editar ingredientes, precios y stock.", icon: "nutrition" },
    { to: "/recetas", title: "Recetas", description: "Crear y editar recetas y sub-recetas.", icon: "menu_book" },
    { to: "/lotes/producir", title: "Producir Lote", description: "Registrar una nueva producción.", icon: "local_fire_department" },
    { to: "/ventas/registrar", title: "Registrar Venta", description: "Registrar una venta de un producto.", icon: "point_of_sale" },
  ],
};

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  // "to" se manda como MAÑANA, no hoy: el backend parsea la fecha con
  // `new Date("YYYY-MM-DD")` (medianoche UTC) y filtra con `lte`, así que
  // usar la fecha de HOY como límite superior excluye silenciosamente
  // todas las ventas de hoy (cualquier hora después de medianoche UTC).
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function todayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

interface SalesSummaryResponse {
  pagination: { totalItems: number };
  summary: { totalRevenue: string };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [lowStock, setLowStock] = React.useState<Ingredient[] | null>(null);
  const [profitability, setProfitability] = React.useState<ProfitabilityReport | null>(null);
  const [recipeCount, setRecipeCount] = React.useState<number | null>(null);
  const [salesToday, setSalesToday] = React.useState<{ count: number; total: string } | null>(null);
  const [recentBatches, setRecentBatches] = React.useState<Batch[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    // Alerta de stock bajo: visible para admin y operario (SDD-08 §8).
    if (user.role === "admin" || user.role === "operario") {
      api
        .get<Paginated<Ingredient>>("/ingredients/low-stock", { pageSize: 100 })
        .then((res) => setLowStock(res.data))
        .catch(() => setLowStock([]));
    }
    if (user.role === "dueño") {
      const { from, to } = currentMonthRange();
      api
        .get<ProfitabilityReport>("/reports/profitability", { from, to })
        .then(setProfitability)
        .catch(() => setProfitability(null));
    }

    // Estadísticas generales: reales, provenientes de endpoints ya
    // existentes (no se inventan métricas sin respaldo en el backend).
    api
      .get<Paginated<unknown>>("/recipes", { page: 1, pageSize: 1 })
      .then((res) => setRecipeCount(res.pagination.totalItems))
      .catch(() => setRecipeCount(null));

    const { from, to } = todayRange();
    api
      .get<SalesSummaryResponse>("/sales", { from, to, page: 1, pageSize: 1 })
      .then((res) => setSalesToday({ count: res.pagination.totalItems, total: res.summary.totalRevenue }))
      .catch(() => setSalesToday(null));

    api
      .get<Paginated<Batch>>("/batches", { page: 1, pageSize: 5, sortOrder: "desc" })
      .then((res) => setRecentBatches(res.data))
      .catch(() => setRecentBatches([]));
  }, [user]);

  if (!user) return null;
  const shortcuts = SHORTCUTS_BY_ROLE[user.role] ?? [];

  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground capitalize">Rol: {user.role}</p>
      </div>

      <div className="dashboard-stats grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="menu_book"
          label="Recetas activas"
          value={recipeCount === null ? "…" : String(recipeCount)}
        />
        <StatCard
          icon="point_of_sale"
          label="Ventas de hoy"
          value={salesToday === null ? "…" : `Bs ${salesToday.total}`}
          hint={salesToday ? `${salesToday.count} venta(s)` : undefined}
        />
        <StatCard
          icon="local_fire_department"
          label="Lotes recientes"
          value={recentBatches === null ? "…" : String(recentBatches.length)}
          hint="Últimos producidos"
        />
        <ExchangeRateCard />
        {(user.role === "admin" || user.role === "operario") && (
          <StatCard
            icon="warning"
            label="Stock bajo mínimo"
            value={lowStock === null ? "…" : String(lowStock.length)}
            tone={lowStock && lowStock.length > 0 ? "warning" : undefined}
          />
        )}
        {user.role === "dueño" && (
          <StatCard
            icon="trending_up"
            label="Ganancia real (mes)"
            value={profitability ? `Bs ${profitability.totals.totalRealProfit}` : "…"}
            hint={profitability ? `Margen ${profitability.totals.realMarginPercent}%` : undefined}
          />
        )}
      </div>

      {user.role === "dueño" && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del mes</CardTitle>
            <CardDescription>Ingresos y ganancia real (rentabilidad) de este mes.</CardDescription>
          </CardHeader>
          <CardContent>
            {!profitability ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <div className="flex flex-wrap gap-6">
                <Metric label="Ingresos" value={`Bs ${profitability.totals.totalRevenue}`} />
                <Metric label="Costo" value={`Bs ${profitability.totals.totalCost}`} />
                <Metric label="Ganancia real" value={`Bs ${profitability.totals.totalRealProfit}`} />
                <Metric label="Margen real" value={`${profitability.totals.realMarginPercent}%`} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Módulos de gestión rápida</h2>
        <div className={user.role === "operario" ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
          {shortcuts.map((s, i) => (
            <Link key={s.to} to={s.to} className="anim-fade-up" style={{ ["--delay" as string]: `${200 + i * 50}ms` }}>
              <Card className={s.big ? "lift h-full hover:border-primary/50 hover:bg-accent/50 sm:min-h-40" : "lift h-full hover:border-primary/50 hover:bg-accent/50"}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={s.icon} size={22} />
                  </span>
                  <div>
                    <CardTitle className={s.big ? "text-xl" : undefined}>{s.title}</CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {(user.role === "admin" || user.role === "operario") && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de stock bajo</CardTitle>
            <CardDescription>Ingredientes por debajo de su nivel mínimo configurado.</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock === null ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : lowStock.length === 0 ? (
              <EmptyState
                compact
                illustration="shelf"
                title="Todo el stock está en orden"
                description="No hay ingredientes por debajo de su nivel mínimo."
                data-testid="dashboard-low-stock-empty"
              />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {lowStock.map((ing) => {
                  const current = Number(ing.currentStock);
                  const min = Number(ing.minStock) || 1;
                  const ratio = Math.max(0, Math.min(1, current / min));
                  const critical = ratio < 0.5;
                  return (
                    <div key={ing.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{ing.name}</p>
                        <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", critical ? "bg-destructive" : "bg-warning")}
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="text-xs text-muted-foreground">
                          {ing.currentStock} / mín {ing.minStock} {ing.baseUnit}
                        </span>
                        <Badge variant={critical ? "destructive" : "warning"}>{critical ? "Crítico" : "Bajo"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <Card data-testid="dashboard-stat-card">
      <CardContent className="flex items-center gap-4 p-4">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
          )}
        >
          <Icon name={icon} size={24} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
