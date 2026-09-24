import * as React from "react";
import { api, fetchAllPages } from "@/lib/api";
import type { Paginated, Product, Recipe, RecipeCostPreview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/Icon";
import { MarginSliderCard } from "@/features/pricing/MarginSliderCard";

// SDD-08 — "Calculadora de Costos": módulo principal a pedido explícito del
// usuario ("nuestro módulo principal"), con entrada directa en la barra
// lateral en vez de quedar escondido dentro de Recetas → detalle. Es una
// herramienta de SOLO LECTURA: reutiliza los mismos endpoints GET que ya
// usan RecipeDetailPage y ProduceBatchPage (/recipes/:id/cost,
// /products/:id/suggested-price) y el mismo patrón de debounce; nunca crea
// ni modifica lotes, recetas ni productos.
export default function CostCalculatorPage() {
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [recipeId, setRecipeId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [cost, setCost] = React.useState<RecipeCostPreview | null>(null);
  const [costLoading, setCostLoading] = React.useState(false);
  const [product, setProduct] = React.useState<Product | null>(null);

  React.useEffect(() => {
    fetchAllPages<Recipe>("/recipes", {}).then(setRecipes);
  }, []);

  const recipe = recipes.find((r) => r.id === recipeId) ?? null;

  // Al elegir una receta, se busca su producto asociado (si existe) para
  // mostrar el margen real a su precio de venta actual — mismo patrón que
  // RecipeDetailPage (GET /products?recipeId=...&pageSize=1).
  React.useEffect(() => {
    if (!recipeId) {
      setProduct(null);
      return;
    }
    api
      .get<Paginated<Product>>("/products", { recipeId, pageSize: 1 })
      .then((r) => setProduct(r.data[0] ?? null))
      .catch(() => setProduct(null));
  }, [recipeId]);

  // Recalculo en vivo del costo con debounce (mismo patrón que
  // ProduceBatchPage, 350ms) — solo lectura, nunca dispara una producción.
  React.useEffect(() => {
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

  const realMarginPercent = React.useMemo(() => {
    if (!cost || !product?.salePrice) return null;
    const salePrice = Number(product.salePrice);
    const costPerUnit = Number(cost.costPerUnit);
    if (!salePrice) return null;
    return ((salePrice - costPerUnit) / salePrice) * 100;
  }, [cost, product]);

  return (
    <div className="flex flex-col gap-4" data-testid="cost-calculator-page">
      <div>
        <h1 className="text-2xl font-semibold">Calculadora de Costos</h1>
        <p className="text-sm text-muted-foreground">
          Explora el costo de cualquier receta sin producir nada. Esta herramienta es solo de consulta: no crea lotes ni modifica recetas o precios.
        </p>
      </div>

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
              <SelectTrigger data-testid="calculator-recipe-select">
                <SelectValue placeholder="Elige una receta" />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id} data-testid={`calculator-recipe-option-${r.name}`}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recipe && (
            <div className="flex flex-col gap-1.5">
              <Label>Cantidad a calcular ({recipe.yieldUnit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="max-w-40"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="calculator-quantity-input"
              />
              <p className="text-xs text-muted-foreground">
                Rendimiento original de la receta: {recipe.yieldQuantity} {recipe.yieldUnit}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {recipe && quantity && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado del cálculo</CardTitle>
            <CardDescription>Se recalcula automáticamente al cambiar la cantidad.</CardDescription>
          </CardHeader>
          <CardContent data-testid="calculator-cost-preview">
            {costLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}
            {!costLoading && cost && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name="payments" size={22} />
                  </span>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Costo total</p>
                    <p className="text-xl font-semibold" data-testid="calculator-total-cost">
                      Bs {cost.totalCost}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name="calculate" size={22} />
                  </span>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Costo por unidad</p>
                    <p className="text-xl font-semibold" data-testid="calculator-cost-per-unit">
                      Bs {cost.costPerUnit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name="trending_up" size={22} />
                  </span>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Margen real al precio actual</p>
                    <p className="text-xl font-semibold" data-testid="calculator-real-margin">
                      {product?.salePrice ? (realMarginPercent === null ? "…" : `${realMarginPercent.toFixed(1)}%`) : "Sin producto asociado"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {product && <MarginSliderCard product={product} />}
    </div>
  );
}
