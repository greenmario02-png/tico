import * as React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth, getErrorMessage } from "@/lib/auth-context";
import type { Paginated, Product, Recipe, RecipeCostPreview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecipeForm } from "@/features/recipes/RecipeForm";
import { EntityImage } from "@/components/EntityImage";
import { MarginSliderCard } from "@/features/pricing/MarginSliderCard";

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "dueño";
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [cost, setCost] = React.useState<RecipeCostPreview | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    api.get<Recipe>(`/recipes/${id}`).then(setRecipe);
    api.get<RecipeCostPreview>(`/recipes/${id}/cost`).then(setCost);
    api.get<Paginated<Product>>("/products", { recipeId: id, pageSize: 1 }).then((r) => setProduct(r.data[0] ?? null));
  }, [id]);

  React.useEffect(load, [load]);

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.delete(`/recipes/${id}`);
      setDeleteOpen(false);
      navigate("/recetas", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!recipe) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4" data-testid="recipe-detail-page">
      <EntityImage
        src={recipe.imageUrl}
        alt={recipe.name}
        className="h-48 w-full rounded-lg border border-border sm:h-64"
        fallbackIconSize={40}
      />
      <div className="flex items-center justify-between">
        <div>
          <Link to="/recetas" className="text-sm text-muted-foreground hover:underline">
            ← Recetas
          </Link>
          <h1 className="text-2xl font-semibold" data-testid="recipe-detail-name">
            {recipe.name}
          </h1>
          {recipe.description && <p className="text-sm text-muted-foreground">{recipe.description}</p>}
          <span data-testid="recipe-detail-is-deleted" className="hidden">
            {String(recipe.isDeleted)}
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="recipe-edit-button">
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} data-testid="recipe-delete-button">
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {recipe.yieldQuantity} {recipe.yieldUnit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merma</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{recipe.wastePercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo total (a rendimiento base)</CardTitle>
          </CardHeader>
          <CardContent>
            {cost ? (
              <>
                <p className="text-xl font-semibold">Bs {cost.totalCost}</p>
                <p className="text-sm text-muted-foreground">Bs {cost.costPerUnit} / unidad</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingredientes y sub-recetas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2" data-testid="recipe-ingredient-lines">
            {(recipe.ingredients ?? []).map((line) => (
              <li key={line.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm">
                <span>
                  {line.type === "sub_recipe" ? (
                    <>
                      {line.subRecipeName} <Badge variant="secondary">(receta)</Badge>
                    </>
                  ) : (
                    line.ingredientName
                  )}
                </span>
                <span className="text-muted-foreground">
                  {line.quantity} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {product && <MarginSliderCard product={product} />}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl" data-testid="recipe-edit-dialog">
          <DialogHeader>
            <DialogTitle>Editar receta</DialogTitle>
          </DialogHeader>
          <RecipeForm
            recipe={recipe}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="recipe-delete-dialog">
          <DialogHeader>
            <DialogTitle>Eliminar receta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar "{recipe.name}"? Esta acción la marca como eliminada (borrado lógico).
          </p>
          {deleteError && (
            <p className="text-sm text-destructive" data-testid="recipe-delete-error">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} data-testid="recipe-delete-cancel">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="recipe-delete-confirm"
            >
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
