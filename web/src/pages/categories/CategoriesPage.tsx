import * as React from "react";
import { fetchAllPages } from "@/lib/api";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Category, CategoryKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryForm } from "@/features/categories/CategoryForm";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";

const KIND_LABEL: Record<CategoryKind, string> = { ingrediente: "Ingrediente", receta: "Receta" };

// Pantalla admin-only, simple: listado filtrable por `kind` + alta/edición/
// borrado en diálogos, siguiendo el mismo patrón que IngredientsListPage.
export default function CategoriesPage() {
  const [kindFilter, setKindFilter] = React.useState<CategoryKind | "">("");
  const [items, setItems] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchAllPages<Category>("/categories", { kind: kindFilter || undefined })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [kindFilter]);

  React.useEffect(load, [load]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/categories/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="categories-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="category-new-button">
          <Icon name="add" size={18} />
          Nueva categoría
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as CategoryKind | "")}
          data-testid="category-kind-filter"
        >
          <option value="">Todas</option>
          <option value="ingrediente">Ingrediente</option>
          <option value="receta">Receta</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="shelf"
          title="No se encontraron categorías"
          description="Prueba con otro filtro o crea una nueva categoría."
          data-testid="categories-empty"
        />
      ) : (
        <Table data-testid="categories-table">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id} data-testid="category-row" data-category-name={c.name}>
                <TableCell className="font-medium" data-testid="category-row-name">
                  {c.name}
                </TableCell>
                <TableCell>{KIND_LABEL[c.kind]}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(c)} data-testid="category-edit-button">
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(c);
                      }}
                      data-testid="category-delete-button"
                    >
                      Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="category-create-dialog">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
          </DialogHeader>
          <CategoryForm
            defaultKind={kindFilter || "ingrediente"}
            onSuccess={() => {
              setCreateOpen(false);
              load();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent data-testid="category-edit-dialog">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              category={editing}
              onSuccess={() => {
                setEditing(null);
                load();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent data-testid="category-delete-dialog">
          <DialogHeader>
            <DialogTitle>Eliminar categoría</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar "{deleting?.name}"? Solo se puede eliminar si ningún ingrediente o receta
            activos la referencian.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive" data-testid="category-delete-error">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="category-delete-cancel">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSubmitting}
              data-testid="category-delete-confirm"
            >
              {deleteSubmitting ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
