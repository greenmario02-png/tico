import * as React from "react";
import { api, fetchAllPages } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Batch, CostDetailApi, Ingredient, Recipe, RecipeCostPreview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface IngredientNeed {
  ingredientId: string;
  name: string;
  neededAfterWaste: number;
  unit: string;
}

function collectNeeds(details: CostDetailApi[], acc: Map<string, IngredientNeed>) {
  for (const d of details) {
    if (d.type === "ingredient" && d.ingredientId) {
      const existing = acc.get(d.ingredientId);
      const qty = Number(d.quantityAfterWaste);
      if (existing) {
        existing.neededAfterWaste += qty;
      } else {
        acc.set(d.ingredientId, { ingredientId: d.ingredientId, name: d.ingredientName ?? "Ingrediente", neededAfterWaste: qty, unit: d.unit });
      }
    } else if (d.subBreakdown) {
      collectNeeds(d.subBreakdown, acc);
    }
  }
}

export default function ProduceBatchPage() {
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([]);
  const [recipeId, setRecipeId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [cost, setCost] = React.useState<RecipeCostPreview | null>(null);
  const [costLoading, setCostLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Batch | null>(null);

  React.useEffect(() => {
    fetchAllPages<Recipe>("/recipes", {}).then(setRecipes);
    fetchAllPages<Ingredient>("/ingredients", { isActive: "true" }).then(setIngredients);
  }, []);

  const recipe = recipes.find((r) => r.id === recipeId) ?? null;
  const ingredientById = React.useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  React.useEffect(() => {
    setResult(null);
    if (!recipeId || !quantity || Number(quantity) <= 0) {
      setCost(null);
      return;
    }
    setCostLoading(true);
    const t = setTimeout(() => {
      api
        .get<RecipeCostPreview>(`/recipes/${recipeId}/cost`, { quantity })
        .then(setCost)
        .catch(() => setCost(null))
        .finally(() => setCostLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [recipeId, quantity]);

  const needs = React.useMemo(() => {
    if (!cost) return [];
    const acc = new Map<string, IngredientNeed>();
    collectNeeds(cost.breakdown, acc);
    return [...acc.values()];
  }, [cost]);

  // Predicción en el cliente de faltantes de stock (nicety de UX, SDD-08
  // §6): la validación real y autoritativa la hace el backend al confirmar
  // (dentro de una transacción con bloqueo de fila), así que esto solo
  // deshabilita el botón y muestra el mismo tipo de mensaje por adelantado.
  const shortages = needs
    .map((need) => {
      const ing = ingredientById.get(need.ingredientId);
      if (!ing) return null;
      const available = Number(ing.currentStock);
      if (available < need.neededAfterWaste) {
        return { ingredientId: need.ingredientId, name: need.name, neededAfterWaste: need.neededAfterWaste, available };
      }
      return null;
    })
    .filter((x): x is { ingredientId: string; name: string; neededAfterWaste: number; available: number } => x !== null);

  const canConfirm = Boolean(cost) && !costLoading && shortages.length === 0 && Number(quantity) > 0;

  function applyQuickScale(multiplier: number) {
    if (!recipe) return;
    setQuantity((Number(recipe.yieldQuantity) * multiplier).toString());
  }

  async function handleConfirm() {
    if (!recipeId) return;
    setSubmitting(true);
    setError(null);
    try {
      const batch = await api.post<Batch>("/batches", { recipeId, requestedUnits: quantity, notes: notes || null });
      setResult(batch);
      setConfirmOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Producir Lote</h1>
      <p className="text-sm text-muted-foreground">
        Elige una receta y cuánto quieres producir. El sistema calcula los ingredientes necesarios y descuenta el stock al confirmar.
      </p>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Receta</Label>
            <Select
              value={recipeId}
              onValueChange={(v) => {
                setRecipeId(v);
                const r = recipes.find((rr) => rr.id === v);
                if (r) setQuantity(r.yieldQuantity);
              }}
            >
              <SelectTrigger data-testid="batch-recipe-select">
                <SelectValue placeholder="Elige una receta" />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id} data-testid={`batch-recipe-option-${r.name}`}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recipe && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Cantidad a producir ({recipe.yieldUnit})</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuantity((Math.max(0, Number(quantity || 0) - 1)).toString())}
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="max-w-32 text-center"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    data-testid="batch-quantity-input"
                  />
                  <Button type="button" variant="outline" onClick={() => setQuantity((Number(quantity || 0) + 1).toString())}>
                    +
                  </Button>
                  <div className="ml-4 flex gap-1">
                    {[1, 2, 3, 5].map((m) => (
                      <Button key={m} type="button" variant="secondary" size="sm" onClick={() => applyQuickScale(m)}>
                        ×{m}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Notas (opcional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {recipe && quantity && (
        <Card>
          <CardHeader>
            <CardTitle>Ingredientes necesarios</CardTitle>
            <CardDescription>Se recalcula automáticamente al cambiar la cantidad.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3" data-testid="batch-cost-preview">
            {costLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}
            {!costLoading && cost && (
              <>
                <ul className="flex flex-col gap-1 text-sm" data-testid="batch-needs-list">
                  {needs.map((n) => {
                    const ing = ingredientById.get(n.ingredientId);
                    const short = shortages.find((s) => s.ingredientId === n.ingredientId);
                    return (
                      <li key={n.ingredientId} className="flex items-center justify-between border-b border-border py-1" data-testid="batch-need-line">
                        <span>{n.name}</span>
                        <span className="flex items-center gap-2">
                          {n.neededAfterWaste.toFixed(3)} {ing?.baseUnit ?? n.unit}
                          {short && (
                            <Badge variant="destructive" data-testid="batch-shortage-badge">
                              faltan {(n.neededAfterWaste - short.available).toFixed(3)} {ing?.baseUnit}
                            </Badge>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span>Costo total</span>
                  <span data-testid="batch-total-cost">Bs {cost.totalCost}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Costo por unidad</span>
                  <span data-testid="batch-cost-per-unit">Bs {cost.costPerUnit}</span>
                </div>

                {shortages.length > 0 && (
                  <p className="text-sm text-destructive" data-testid="batch-shortage-message">
                    No hay stock suficiente para esta cantidad. Resuelve el faltante (registra una compra) antes de confirmar.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive" data-testid="batch-error">{error}</p>}

      {result && (
        <Card className="border-green-600" data-testid="batch-success">
          <CardHeader>
            <CardTitle className="text-success">Lote producido correctamente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p data-testid="batch-success-total-cost">Costo total del lote: Bs {result.totalCostSnapshot}</p>
            <p data-testid="batch-success-cost-per-unit">Costo por unidad: Bs {result.costPerUnitSnapshot}</p>
            {result.unitsRemaining !== undefined && (
              <p data-testid="batch-success-units-remaining">Unidades restantes en el lote: {result.unitsRemaining}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <Button disabled={!canConfirm} onClick={() => setConfirmOpen(true)} data-testid="batch-produce-button">
          Producir lote
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="batch-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar producción de lote</DialogTitle>
            <DialogDescription>
              Esta acción descuenta stock de forma inmediata y no se puede deshacer. Revisa lo que se va a descontar:
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm" data-testid="batch-confirm-needs-list">
            {needs.map((n) => (
              <li key={n.ingredientId} className="flex justify-between border-b border-border py-1">
                <span>{n.name}</span>
                <span>
                  −{n.neededAfterWaste.toFixed(3)} {ingredientById.get(n.ingredientId)?.baseUnit ?? n.unit}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium">
            Producirás {quantity} {recipe?.yieldUnit} de "{recipe?.name}" por un costo total de Bs {cost?.totalCost}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid="batch-confirm-cancel">
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={submitting} data-testid="batch-confirm-submit">
              {submitting ? "Produciendo…" : "Confirmar y descontar stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
