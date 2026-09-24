import { EmptyState } from "@/components/EmptyState";
import * as React from "react";
import { Link } from "react-router-dom";
import { fetchAllPages } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Ingredient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IngredientForm } from "@/features/ingredients/IngredientForm";
import { EntityImage } from "@/components/EntityImage";
import { Icon } from "@/components/Icon";

export default function IngredientsListPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "dueño";
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<Ingredient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  const categories = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const i of items) if (i.categoryId && i.categoryName) set.set(i.categoryId, i.categoryName);
    return [...set.entries()];
  }, [items]);
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");

  const load = React.useCallback(() => {
    setLoading(true);
    fetchAllPages<Ingredient>("/ingredients", { search: search || undefined, categoryId: categoryFilter || undefined })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [search, categoryFilter]);

  React.useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-4" data-testid="ingredients-list-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Ingredientes</h1>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)} data-testid="ingredient-new-button">
            <Icon name="add" size={18} />
            Nuevo ingrediente
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="ingredient-search-input"
        />
        {categories.length > 0 && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="box"
          title="No se encontraron ingredientes"
          description="Ajusta la búsqueda o los filtros para ver resultados."
          data-testid="ingredients-empty"
        />
      ) : (
        <Table data-testid="ingredients-table">
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio actual</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((ing) => {
              const isLow = Number(ing.currentStock) < Number(ing.minStock);
              return (
                <TableRow key={ing.id} data-testid="ingredient-row" data-ingredient-name={ing.name}>
                  <TableCell>
                    <EntityImage
                      src={ing.imageUrl}
                      alt={ing.name}
                      className="h-10 w-10 rounded-md border border-border"
                      fallbackIconSize={16}
                    />
                  </TableCell>
                  <TableCell className="font-medium" data-testid="ingredient-row-name">
                    {ing.name}
                  </TableCell>
                  <TableCell>{ing.categoryName ?? "—"}</TableCell>
                  <TableCell>
                    {ing.currentPricePerBaseUnit ? `Bs ${ing.currentPricePerBaseUnit} / ${ing.baseUnit}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {ing.currentStock} {ing.baseUnit}
                      {isLow && <Badge variant="warning">stock bajo</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/ingredientes/${ing.id}`}>
                      <Button variant="outline" size="sm" data-testid="ingredient-view-button">
                        Ver
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="ingredient-create-dialog">
          <DialogHeader>
            <DialogTitle>Nuevo ingrediente</DialogTitle>
          </DialogHeader>
          <IngredientForm
            onSuccess={() => {
              setCreateOpen(false);
              load();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
