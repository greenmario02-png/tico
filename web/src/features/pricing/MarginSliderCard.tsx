import * as React from "react";
import { api } from "@/lib/api";
import type { Product, SuggestedPrice } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

// SDD-08 §11.1 — slider de margen: mueve el slider y recalcula el precio
// sugerido en vivo contra el endpoint real, con debounce para no saturar
// la API en cada pixel de arrastre.
//
// Extraído de RecipeDetailPage para reutilizarlo también en la Calculadora
// de Costos (src/pages/calculator/CostCalculatorPage.tsx) sin duplicar la
// lógica de debounce + llamada a /products/:id/suggested-price.
export function MarginSliderCard({ product }: { product: Product }) {
  const [margin, setMargin] = React.useState(30);
  const [suggested, setSuggested] = React.useState<SuggestedPrice | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      api
        .get<SuggestedPrice>(`/products/${product.id}/suggested-price`, { margin })
        .then(setSuggested)
        .catch(() => setSuggested(null));
    }, 250);
    return () => clearTimeout(t);
  }, [margin, product.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precio de venta — {product.name}</CardTitle>
        <CardDescription>Precio de venta = costo / (1 - margen%). Mueve el slider para simular otro margen.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Slider min={1} max={95} value={margin} onValueChange={setMargin} className="max-w-sm" data-testid="margin-slider" />
          <span className="w-16 text-right font-medium">{margin}%</span>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Precio de venta actual</p>
            <p className="text-lg font-semibold">{product.salePrice ? `Bs ${product.salePrice}` : "No definido"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Precio sugerido a {margin}%</p>
            <p className="text-lg font-semibold" data-testid="margin-suggested-price">
              {suggested ? `Bs ${suggested.suggestedPrice}` : "Calculando…"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
