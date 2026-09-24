import * as React from "react";
import { api, fetchAllPages } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Product, Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RegisterSalePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [salePrice, setSalePrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<Sale | null>(null);

  React.useEffect(() => {
    fetchAllPages<Product>("/products", {}).then(setProducts);
  }, []);

  const product = products.find((p) => p.id === productId) ?? null;

  React.useEffect(() => {
    if (product?.salePrice) setSalePrice(product.salePrice);
  }, [product]);

  const revenue = Number(quantity || 0) * Number(salePrice || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setResult(null);
    try {
      const sale = await api.post<Sale>("/sales", {
        productId,
        quantity,
        salePricePerUnit: salePrice,
      });
      setResult(sale);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Registrar Venta</h1>

      <Card className="max-w-lg">
        <CardContent className="pt-4">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label>Producto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger data-testid="sale-product-select">
                  <SelectValue placeholder="Elige un producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`sale-product-option-${p.name}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale-qty">Cantidad</Label>
              <Input
                id="sale-qty"
                type="number"
                step="0.01"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="sale-quantity-input"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale-price">Precio de venta por unidad (Bs)</Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0"
                required
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                data-testid="sale-price-input"
              />
            </div>

            <p className="text-sm text-muted-foreground" data-testid="sale-total-preview">Total a cobrar: Bs {revenue.toFixed(2)}</p>

            {error && <p className="text-sm text-destructive" data-testid="sale-error">{error}</p>}

            <Button type="submit" disabled={submitting || !productId} data-testid="sale-submit-button">
              {submitting ? "Registrando…" : "Registrar venta"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="max-w-lg border-green-600" data-testid="sale-success">
          <CardHeader>
            <CardTitle className="text-success">Venta registrada</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p data-testid="sale-success-quantity">Cantidad: {result.quantity}</p>
            <p data-testid="sale-success-price">Precio de venta: Bs {result.salePricePerUnit}</p>
            <p data-testid="sale-success-cost">Costo (snapshot): Bs {result.costPerUnitSnapshot}</p>
            <p data-testid="sale-success-revenue">Ingreso total: Bs {result.revenue}</p>
            <p className="font-medium" data-testid="sale-success-profit">Ganancia real: Bs {result.realProfit} ({result.realMarginPercent}%)</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
