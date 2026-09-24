import { EmptyState } from "@/components/EmptyState";
import * as React from "react";
import { api } from "@/lib/api";
import type { InventoryMovement, InventoryRow, MovementType, Paginated } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const MOVEMENT_LABEL: Record<MovementType, string> = {
  compra: "Compra",
  uso_produccion: "Uso en producción",
  ajuste: "Ajuste",
  merma: "Merma",
};

export default function InventoryPage() {
  const [view, setView] = React.useState<"stock" | "movimientos">("stock");
  const [rows, setRows] = React.useState<InventoryRow[]>([]);
  const [summary, setSummary] = React.useState<{ totalStockValue: string } | null>(null);

  React.useEffect(() => {
    api
      .get<Paginated<InventoryRow> & { summary: { totalStockValue: string } }>("/inventory", { pageSize: 200 })
      .then((r) => {
        setRows(r.data);
        setSummary(r.summary);
      });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <div className="flex gap-2">
          <Button
            variant={view === "stock" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("stock")}
            data-testid="inventory-view-stock-button"
          >
            Stock actual
          </Button>
          <Button
            variant={view === "movimientos" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("movimientos")}
            data-testid="inventory-view-movements-button"
          >
            Movimientos (kardex)
          </Button>
        </div>
      </div>

      {view === "stock" ? (
        <>
          {summary && (
            <Card className="max-w-xs" data-testid="inventory-summary-card">
              <CardHeader>
                <CardTitle className="text-base">Valor total en stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold" data-testid="inventory-summary-total">Bs {summary.totalStockValue}</p>
              </CardContent>
            </Card>
          )}

          <Table data-testid="inventory-table">
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Stock actual</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Valor en stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid="inventory-row">
                  <TableCell className="font-medium" data-testid="inventory-row-name">{r.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span data-testid="inventory-row-stock">{r.currentStock} {r.baseUnit}</span>
                      {r.isBelowMin && <Badge variant="warning" data-testid="inventory-row-below-min">bajo mínimo</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.minStock} {r.baseUnit}
                  </TableCell>
                  <TableCell data-testid="inventory-row-value">Bs {r.stockValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <MovementsView ingredientOptions={rows} />
      )}
    </div>
  );
}

// Kardex de movimientos de inventario (GET /api/inventory/movements,
// SDD-05 §10.2) — gap encontrado en la última ronda de QA (ver
// qa-evidence/web/RESUMEN.md): el backend ya expone el endpoint, pero
// InventoryPage no lo mostraba. Sin filtro de ingrediente trae los últimos
// 30 días de TODOS los ingredientes (default del backend); con filtro,
// solo los del ingrediente elegido.
function MovementsView({ ingredientOptions }: { ingredientOptions: InventoryRow[] }) {
  const [ingredientId, setIngredientId] = React.useState("");
  const [movementType, setMovementType] = React.useState<MovementType | "">("");
  const [movements, setMovements] = React.useState<InventoryMovement[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<InventoryMovement>>("/inventory/movements", {
        ingredientId: ingredientId || undefined,
        movementType: movementType || undefined,
        pageSize: 100,
      })
      .then((r) => setMovements(r.data))
      .finally(() => setLoading(false));
  }, [ingredientId, movementType]);

  React.useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-4" data-testid="inventory-movements-view">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          data-testid="inventory-movements-ingredient-filter"
        >
          <option value="">Todos los ingredientes</option>
          {ingredientOptions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={movementType}
          onChange={(e) => setMovementType(e.target.value as MovementType | "")}
          data-testid="inventory-movements-type-filter"
        >
          <option value="">Todos los tipos</option>
          <option value="compra">Compra</option>
          <option value="uso_produccion">Uso en producción</option>
          <option value="ajuste">Ajuste</option>
          <option value="merma">Merma</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : movements.length === 0 ? (
        <EmptyState
          illustration="box"
          title="No hay movimientos para este filtro"
          description="Si no eliges un rango de fechas se muestran los últimos 30 días."
          data-testid="inventory-movements-empty"
        />
      ) : (
        <Table data-testid="inventory-movements-table">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id} data-testid="inventory-movement-row">
                <TableCell data-testid="inventory-movement-date">
                  {new Date(m.createdAt).toLocaleString("es-BO")}
                </TableCell>
                <TableCell>{m.ingredientName}</TableCell>
                <TableCell data-testid="inventory-movement-type">{MOVEMENT_LABEL[m.movementType]}</TableCell>
                <TableCell data-testid="inventory-movement-quantity">{m.quantityBaseUnit}</TableCell>
                <TableCell>{m.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
