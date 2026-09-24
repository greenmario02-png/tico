import { EmptyState } from "@/components/EmptyState";
import * as React from "react";
import { Link } from "react-router-dom";
import { fetchAllPages } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Recipe } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecipeForm } from "@/features/recipes/RecipeForm";
import { EntityImage } from "@/components/EntityImage";
import { Icon } from "@/components/Icon";

export default function RecipesListPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "dueño";
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<Recipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchAllPages<Recipe>("/recipes", { search: search || undefined })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [search]);

  React.useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-4" data-testid="recipes-list-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Recetas</h1>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)} data-testid="recipe-new-button">
            <Icon name="add" size={18} />
            Nueva receta
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
        data-testid="recipe-search-input"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="shelf"
          title="No se encontraron recetas"
          description="Prueba con otra búsqueda o crea una receta nueva."
          data-testid="recipes-empty"
        />
      ) : (
        <Table data-testid="recipes-table">
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rendimiento</TableHead>
              <TableHead>Merma</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} data-testid="recipe-row" data-recipe-name={r.name}>
                <TableCell>
                  <EntityImage
                    src={r.imageUrl}
                    alt={r.name}
                    className="h-10 w-10 rounded-md border border-border"
                    fallbackIconSize={16}
                  />
                </TableCell>
                <TableCell className="font-medium" data-testid="recipe-row-name">
                  {r.name}
                </TableCell>
                <TableCell>
                  {r.yieldQuantity} {r.yieldUnit}
                </TableCell>
                <TableCell>{r.wastePercent}%</TableCell>
                <TableCell className="text-right">
                  <Link to={`/recetas/${r.id}`}>
                    <Button variant="outline" size="sm" data-testid="recipe-view-button">
                      Ver
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl" data-testid="recipe-create-dialog">
          <DialogHeader>
            <DialogTitle>Nueva receta</DialogTitle>
          </DialogHeader>
          <RecipeForm
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
