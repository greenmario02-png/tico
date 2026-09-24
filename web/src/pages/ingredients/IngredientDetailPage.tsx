import * as React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { getErrorMessage, useAuth } from "@/lib/auth-context";
import type { Ingredient, Paginated, PriceHistoryEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PriceSparkline } from "@/components/PriceSparkline";
import { IngredientForm } from "@/features/ingredients/IngredientForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityImage } from "@/components/EntityImage";

export default function IngredientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "dueño";
  const navigate = useNavigate();
  const [ingredient, setIngredient] = React.useState<Ingredient | null>(null);
  const [history, setHistory] = React.useState<PriceHistoryEntry[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    api.get<Ingredient>(`/ingredients/${id}`).then(setIngredient);
    api.get<Paginated<PriceHistoryEntry>>(`/ingredients/${id}/price-history`, { pageSize: 50 }).then((r) => setHistory(r.data));
  }, [id]);

  React.useEffect(load, [load]);

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.delete(`/ingredients/${id}`);
      setDeleteOpen(false);
      navigate("/ingredientes", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!ingredient) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const isLow = Number(ingredient.currentStock) < Number(ingredient.minStock);
  const sortedHistory = [...history].sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime());

  return (
    <div className="flex flex-col gap-4" data-testid="ingredient-detail-page">
      <EntityImage
        src={ingredient.imageUrl}
        alt={ingredient.name}
        className="h-48 w-full rounded-lg border border-border sm:h-64"
        fallbackIconSize={40}
      />
      <div className="flex items-center justify-between">
        <div>
          <Link to="/ingredientes" className="text-sm text-muted-foreground hover:underline">
            ← Ingredientes
          </Link>
          <h1 className="text-2xl font-semibold" data-testid="ingredient-detail-name">
            {ingredient.name}
          </h1>
          <span data-testid="ingredient-detail-is-active" className="hidden">
            {String(ingredient.isActive)}
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="ingredient-edit-button">
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} data-testid="ingredient-delete-button">
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Precio actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {ingredient.currentPricePerBaseUnit ? `Bs ${ingredient.currentPricePerBaseUnit}` : "—"} / {ingredient.baseUnit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {ingredient.currentStock} {ingredient.baseUnit}
            </p>
            {isLow && <Badge variant="warning">Por debajo del mínimo ({ingredient.minStock})</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categoría / Proveedor</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{ingredient.categoryName ?? "Sin categoría"}</p>
            <p>{ingredient.supplierName ?? "Sin proveedor"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de precios</CardTitle>
          <CardDescription>Nunca se sobrescribe: cada cambio queda registrado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sortedHistory.length >= 2 && <PriceSparkline values={sortedHistory.map((h) => Number(h.pricePerBaseUnit))} />}
          <ul className="flex flex-col gap-1 text-sm">
            {[...history]
              .sort((a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime())
              .map((h) => (
                <li key={h.id} className="flex justify-between border-b border-border py-1">
                  <span>{new Date(h.effectiveAt).toLocaleDateString("es-BO")}</span>
                  <span className="font-medium">Bs {h.pricePerBaseUnit}</span>
                </li>
              ))}
            {history.length === 0 && <li className="text-muted-foreground">Sin historial todavía.</li>}
          </ul>
        </CardContent>
      </Card>

      {canEdit && <PurchaseAndPriceForms ingredient={ingredient} onChanged={load} />}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="ingredient-edit-dialog">
          <DialogHeader>
            <DialogTitle>Editar ingrediente</DialogTitle>
          </DialogHeader>
          <IngredientForm
            ingredient={ingredient}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="ingredient-delete-dialog">
          <DialogHeader>
            <DialogTitle>Eliminar ingrediente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar "{ingredient.name}"? Esta acción lo desactiva (borrado lógico), no borra su historial.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive" data-testid="ingredient-delete-error">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} data-testid="ingredient-delete-cancel">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="ingredient-delete-confirm"
            >
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseAndPriceForms({ ingredient, onChanged }: { ingredient: Ingredient; onChanged: () => void }) {
  const [quantity, setQuantity] = React.useState("");
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null);
  const [purchaseOk, setPurchaseOk] = React.useState<string | null>(null);
  const [purchaseSubmitting, setPurchaseSubmitting] = React.useState(false);

  const [newPrice, setNewPrice] = React.useState("");
  const [priceError, setPriceError] = React.useState<string | null>(null);
  const [priceOk, setPriceOk] = React.useState<string | null>(null);
  const [priceSubmitting, setPriceSubmitting] = React.useState(false);

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault();
    setPurchaseError(null);
    setPurchaseOk(null);
    setPurchaseSubmitting(true);
    try {
      await api.post(`/ingredients/${ingredient.id}/purchase`, { quantityBaseUnit: quantity });
      setPurchaseOk("Compra registrada.");
      setQuantity("");
      onChanged();
    } catch (err) {
      setPurchaseError(getErrorMessage(err));
    } finally {
      setPurchaseSubmitting(false);
    }
  }

  async function handlePrice(e: React.FormEvent) {
    e.preventDefault();
    setPriceError(null);
    setPriceOk(null);
    setPriceSubmitting(true);
    try {
      await api.post(`/ingredients/${ingredient.id}/price`, { pricePerBaseUnit: newPrice });
      setPriceOk("Precio actualizado.");
      setNewPrice("");
      onChanged();
    } catch (err) {
      setPriceError(getErrorMessage(err));
    } finally {
      setPriceSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar compra (entrada de stock)</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={handlePurchase}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-qty">Cantidad ({ingredient.baseUnit})</Label>
              <Input
                id="purchase-qty"
                type="number"
                step="0.001"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            {purchaseError && <p className="text-sm text-destructive">{purchaseError}</p>}
            {purchaseOk && <p className="text-sm text-success">{purchaseOk}</p>}
            <Button type="submit" disabled={purchaseSubmitting}>
              {purchaseSubmitting ? "Registrando…" : "Registrar compra"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar cambio de precio</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={handlePrice}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-price">Nuevo precio por unidad base (Bs)</Label>
              <Input
                id="new-price"
                type="number"
                step="0.0001"
                min="0"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                data-testid="ingredient-price-input"
              />
            </div>
            {priceError && (
              <p className="text-sm text-destructive" data-testid="ingredient-price-error">
                {priceError}
              </p>
            )}
            {priceOk && (
              <p className="text-sm text-success" data-testid="ingredient-price-success">
                {priceOk}
              </p>
            )}
            <Button type="submit" disabled={priceSubmitting} data-testid="ingredient-price-submit">
              {priceSubmitting ? "Guardando…" : "Guardar nuevo precio"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
