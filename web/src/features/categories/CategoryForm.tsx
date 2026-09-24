import * as React from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Category, CategoryKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: "ingrediente", label: "Ingrediente" },
  { value: "receta", label: "Receta" },
];

export interface CategoryFormProps {
  /** Si se pasa, el formulario edita esa categoría en vez de crear una nueva. */
  category?: Category;
  /** Kind fijo con el que arranca el formulario de creación (p. ej. desde un filtro activo). */
  defaultKind?: CategoryKind;
  onSuccess: (category: Category) => void;
  onCancel?: () => void;
}

// POST /api/categories: { name, kind }. PUT /api/categories/:id: solo
// `name` es editable — `kind` es inmutable tras creación (SDD-05 §4.3), así
// que el selector de tipo se deshabilita en modo edición.
export function CategoryForm({ category, defaultKind, onSuccess, onCancel }: CategoryFormProps) {
  const isEdit = Boolean(category);
  const [name, setName] = React.useState(category?.name ?? "");
  const [kind, setKind] = React.useState<CategoryKind>(category?.kind ?? defaultKind ?? "ingrediente");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        isEdit && category
          ? await api.put<Category>(`/categories/${category.id}`, { name })
          : await api.post<Category>("/categories", { name, kind });
      onSuccess(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="category-form">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-name">Nombre</Label>
        <Input
          id="cat-name"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Harinas"
          data-testid="category-form-name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-kind">Tipo</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as CategoryKind)} disabled={isEdit}>
          <SelectTrigger id="cat-kind" data-testid="category-form-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value} data-testid={`category-form-kind-option-${k.value}`}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="category-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} data-testid="category-form-cancel">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="category-form-submit">
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </form>
  );
}
