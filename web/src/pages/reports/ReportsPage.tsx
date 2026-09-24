import { EmptyState } from "@/components/EmptyState";
import * as React from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { ProfitabilityReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProductionRow {
  recipeId: string;
  recipeName: string | null;
  unitsProduced: string;
  totalProductionCost: string;
  unitsSold: string;
  totalRevenue: string;
  totalRealProfit: string;
}

interface ProductionReport {
  from: string;
  to: string;
  data: ProductionRow[];
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  // Ver nota equivalente en DashboardPage.tsx: se manda MAÑANA como "to"
  // para no excluir las ventas/lotes de hoy por el corte a medianoche UTC
  // que hace el backend al parsear la fecha.
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ReportsPage() {
  const defaults = currentMonthRange();
  const [from, setFrom] = React.useState(defaults.from);
  const [to, setTo] = React.useState(defaults.to);
  const [profitability, setProfitability] = React.useState<ProfitabilityReport | null>(null);
  const [production, setProduction] = React.useState<ProductionReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    api.get<ProfitabilityReport>("/reports/profitability", { from, to }).then(setProfitability).catch((e) => setError(getErrorMessage(e)));
    api.get<ProductionReport>("/reports/production", { from, to, pageSize: 200 }).then(setProduction).catch((e) => setError(getErrorMessage(e)));
  }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="reports-from-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="reports-to-input" />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" data-testid="reports-error">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Rentabilidad por producto</CardTitle>
          {profitability?.lowProfitabilityThresholdPercent !== undefined && (
            <p className="text-xs text-muted-foreground" data-testid="reports-profitability-threshold">
              Se marca como "poco rentable" un producto con margen real menor a {profitability.lowProfitabilityThresholdPercent}%.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!profitability ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : profitability.data.length === 0 ? (
            <EmptyState compact illustration="shelf" title="No hay ventas en este período" description="Registra ventas o amplía el rango de fechas." data-testid="reports-profitability-empty" />
          ) : (
            <Table data-testid="reports-profitability-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Unidades vendidas</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Ganancia real</TableHead>
                  <TableHead>Margen real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitability.data.map((row) => (
                  <TableRow key={row.productId} data-testid="reports-profitability-row">
                    <TableCell className="font-medium" data-testid="reports-profitability-product">
                      <span className="flex items-center gap-2">
                        {row.productName}
                        {row.isLowProfitability && (
                          <Badge variant="warning" data-testid="reports-profitability-low-badge">
                            poco rentable
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{row.unitsSold}</TableCell>
                    <TableCell>Bs {row.totalRevenue}</TableCell>
                    <TableCell>Bs {row.totalCost}</TableCell>
                    <TableCell data-testid="reports-profitability-profit">Bs {row.totalRealProfit}</TableCell>
                    <TableCell data-testid="reports-profitability-margin">{row.realMarginPercent}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Producción por receta</CardTitle>
        </CardHeader>
        <CardContent>
          {!production ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : production.data.length === 0 ? (
            <EmptyState compact illustration="box" title="No hay producción en este período" description="Produce un lote o amplía el rango de fechas." data-testid="reports-production-empty" />
          ) : (
            <Table data-testid="reports-production-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Receta</TableHead>
                  <TableHead>Unidades producidas</TableHead>
                  <TableHead>Costo de producción</TableHead>
                  <TableHead>Unidades vendidas</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Ganancia real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {production.data.map((row) => (
                  <TableRow key={row.recipeId} data-testid="reports-production-row">
                    <TableCell className="font-medium" data-testid="reports-production-recipe">{row.recipeName}</TableCell>
                    <TableCell>{row.unitsProduced}</TableCell>
                    <TableCell>Bs {row.totalProductionCost}</TableCell>
                    <TableCell>{row.unitsSold}</TableCell>
                    <TableCell>Bs {row.totalRevenue}</TableCell>
                    <TableCell data-testid="reports-production-profit">Bs {row.totalRealProfit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
