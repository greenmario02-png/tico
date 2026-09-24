import * as React from "react";
import { api, fetchAllPages } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { BaseUnit, Category, Ingredient, Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUrlField } from "@/components/ImageUrlField";

const BASE_UNITS: { value: BaseUnit; label: string }[] = [
  { value: "g", label: "Gramos (g)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "pieza", label: "Pieza" },
];

// Sentinel para "sin categoría"/"sin proveedor": Radix Select no admite
// SelectItem con value="" (colisiona con el estado "sin selección" interno).
const NONE = "__none__";

export interface IngredientFormProps {
  /** Si se pasa, el formulario edita ese ingrediente en vez de crear uno nuevo. */
  ingredient?: Ingredient;
  /** Modo compacto: solo los campos mínimos requeridos (usado en el modal desde Recetas). */
  compact?: boolean;
  onSuccess: (ingredient: Ingredient) => void;
  onCancel?: () => void;
}

// Campo mínimo requerido por POST /api/ingredients (ver
// app/backend/src/routes/ingredients.ts): name, baseUnit,
// initialPricePerBaseUnit, currentStock (opcional, default 0), minStock
// (opcional, default 0). categoryId/supplierId son opcionales, poblados
// desde GET /api/categories?kind=ingrediente y GET /api/suppliers
// (SDD-05 §4-5).
export function IngredientForm({ ingredient, compact, onSuccess, onCancel }: IngredientFormProps) {
  const isEdit = Boolean(ingredient);
  const [name, setName] = React.useState(ingredient?.name ?? "");
  const [baseUnit, setBaseUnit] = React.useState<BaseUnit>(ingredient?.baseUnit ?? "g");
  const [price, setPrice] = React.useState(ingredient?.currentPricePerBaseUnit ?? "");
  const [stock, setStock] = React.useState(ingredient?.currentStock ?? "0");
  const [minStock, setMinStock] = React.useState(ingredient?.minStock ?? "0");
  const [categoryId, setCategoryId] = React.useState(ingredient?.categoryId ?? NONE);
  const [supplierId, setSupplierId] = React.useState(ingredient?.supplierId ?? NONE);
  const [imageUrl, setImageUrl] = React.useState(ingredient?.imageUrl ?? "");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetchAllPages<Category>("/categories", { kind: "ingrediente" }).then(setCategories).catch(() => setCategories([]));
    fetchAllPages<Supplier>("/suppliers", {}).then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Importante: este <form> puede montarse dentro del modal de creación
    // rápida abierto DESDE el formulario de Recetas (React Portal). Los
    // eventos de React burbujean según el árbol de COMPONENTES, no el árbol
    // real del DOM, así que sin stopPropagation() este submit también
    // dispararía el onSubmit del <form> de RecipeForm que lo contiene.
    e.stopPropagation();
    setError(null);
    setSubmitting(true);
    try {
      let result: Ingredient;
      if (isEdit && ingredient) {
        result = await api.put<Ingredient>(`/ingredients/${ingredient.id}`, {
          name,
          baseUnit,
          minStock,
          categoryId: categoryId === NONE ? null : categoryId,
          supplierId: supplierId === NONE ? null : supplierId,
          imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
        });
      } else {
        result = await api.post<Ingredient>("/ingredients", {
          name,
          baseUnit,
          initialPricePerBaseUnit: price,
          currentStock: stock,
          minStock,
          categoryId: categoryId === NONE ? null : categoryId,
          supplierId: supplierId === NONE ? null : supplierId,
          imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
        });
      }
      onSuccess(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="ingredient-form">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ing-name">Nombre</Label>
        <Input
          id="ing-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Harina de trigo"
          data-testid="ingredient-form-name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ing-unit">Unidad base</Label>
        <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as BaseUnit)} disabled={isEdit ? false : false}>
          <SelectTrigger id="ing-unit" data-testid="ingredient-form-unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASE_UNITS.map((u) => (
              <SelectItem key={u.value} value={u.value} data-testid={`ingredient-form-unit-option-${u.value}`}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ing-price">Precio inicial por unidad base (Bs)</Label>
          <Input
            id="ing-price"
            type="number"
            step="0.0001"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="ingredient-form-price"
          />
        </div>
      )}

      {!isEdit && !compact && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ing-stock">Stock inicial</Label>
          <Input
            id="ing-stock"
            type="number"
            step="0.001"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            data-testid="ingredient-form-stock"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ing-minstock">Stock mínimo (para alertas)</Label>
        <Input
          id="ing-minstock"
          type="number"
          step="0.001"
          min="0"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
          data-testid="ingredient-form-minstock"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ing-category">Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="ing-category" data-testid="ingredient-form-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} data-testid={`ingredient-form-category-option-${c.id}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!compact && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ing-supplier">Proveedor</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger id="ing-supplier" data-testid="ingredient-form-supplier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin proveedor</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id} data-testid={`ingredient-form-supplier-option-${s.id}`}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ImageUrlField
        id="ing-image"
        value={imageUrl}
        onChange={setImageUrl}
        testId="ingredient-form-image-url"
      />

      {error && (
        <p className="text-sm text-destructive" data-testid="ingredient-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} data-testid="ingredient-form-cancel">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="ingredient-form-submit">
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear ingrediente"}
        </Button>
      </div>
    </form>
  );
}
