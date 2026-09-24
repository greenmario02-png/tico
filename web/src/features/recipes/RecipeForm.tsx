import * as React from "react";
import { api, fetchAllPages } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Category, Ingredient, Recipe, RecipeIngredientLine, RecipeIngredientUnit, RecipeYieldUnit } from "@/lib/types";
import { RECIPE_INGREDIENT_UNITS, RECIPE_YIELD_UNITS } from "@/lib/types";

// Sentinel para "sin categoría": Radix Select no admite SelectItem con
// value="" (colisiona con el estado "sin selección" interno).
const NONE = "__none__";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IngredientPicker } from "./IngredientPicker";
import { ImageUrlField } from "@/components/ImageUrlField";

interface Line {
  key: string;
  kind: "ingredient" | "sub_recipe";
  ingredientId: string;
  ingredientName: string;
  subRecipeId: string;
  quantity: string;
  unit: RecipeIngredientUnit;
}

function lineFromExisting(l: RecipeIngredientLine): Line {
  return {
    key: l.id,
    kind: l.type,
    ingredientId: l.ingredientId ?? "",
    ingredientName: l.ingredientName ?? "",
    subRecipeId: l.subRecipeId ?? "",
    quantity: l.quantity,
    unit: l.unit,
  };
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `new-${keyCounter}`;
}

export interface RecipeFormProps {
  recipe?: Recipe;
  onSuccess: (recipe: Recipe) => void;
  onCancel?: () => void;
}

export function RecipeForm({ recipe, onSuccess, onCancel }: RecipeFormProps) {
  const isEdit = Boolean(recipe);
  const [name, setName] = React.useState(recipe?.name ?? "");
  const [description, setDescription] = React.useState(recipe?.description ?? "");
  const [yieldQuantity, setYieldQuantity] = React.useState(recipe?.yieldQuantity ?? "1");
  const [yieldUnit, setYieldUnit] = React.useState<RecipeYieldUnit>(recipe?.yieldUnit ?? "pieza");
  const [wastePercent, setWastePercent] = React.useState(recipe?.wastePercent ?? "0");
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState(recipe?.prepTimeMinutes?.toString() ?? "");
  const [bakeTimeMinutes, setBakeTimeMinutes] = React.useState(recipe?.bakeTimeMinutes?.toString() ?? "");
  const [instructions, setInstructions] = React.useState(recipe?.instructions ?? "");
  const [imageUrl, setImageUrl] = React.useState(recipe?.imageUrl ?? "");
  const [categoryId, setCategoryId] = React.useState(recipe?.categoryId ?? NONE);
  const [lines, setLines] = React.useState<Line[]>(recipe?.ingredients?.map(lineFromExisting) ?? []);

  const [ingredients, setIngredients] = React.useState<Ingredient[]>([]);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetchAllPages<Ingredient>("/ingredients", { isActive: "true" }).then(setIngredients);
    fetchAllPages<Recipe>("/recipes", {}).then(setRecipes);
    fetchAllPages<Category>("/categories", { kind: "receta" }).then(setCategories).catch(() => setCategories([]));
  }, []);

  const ingredientById = React.useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  // Excluye la receta actual de las opciones de sub-receta (auto-referencia
  // directa); ciclos más profundos los detecta el backend al guardar.
  const subRecipeOptions = recipes.filter((r) => r.id !== recipe?.id);

  function addLine(kind: "ingredient" | "sub_recipe") {
    setLines((prev) => [
      ...prev,
      { key: newKey(), kind, ingredientId: "", ingredientName: "", subRecipeId: "", quantity: "", unit: "g" },
    ]);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payloadLines = lines.map((l) => ({
      ingredientId: l.kind === "ingredient" ? l.ingredientId || null : null,
      subRecipeId: l.kind === "sub_recipe" ? l.subRecipeId || null : null,
      quantity: l.quantity,
      unit: l.unit,
    }));

    setSubmitting(true);
    try {
      const body = {
        name,
        description: description || null,
        categoryId: categoryId === NONE ? null : categoryId,
        yieldQuantity,
        yieldUnit,
        wastePercent,
        prepTimeMinutes: prepTimeMinutes === "" ? null : Number(prepTimeMinutes),
        bakeTimeMinutes: bakeTimeMinutes === "" ? null : Number(bakeTimeMinutes),
        instructions: instructions || null,
        imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
        ingredients: payloadLines,
      };
      const result = isEdit && recipe ? await api.put<Recipe>(`/recipes/${recipe.id}`, body) : await api.post<Recipe>("/recipes", body);
      onSuccess(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} data-testid="recipe-form">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="rec-name">Nombre de la receta</Label>
          <Input id="rec-name" required value={name} onChange={(e) => setName(e.target.value)} data-testid="recipe-form-name" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-yield">Rendimiento</Label>
          <Input
            id="rec-yield"
            type="number"
            step="0.01"
            min="0"
            required
            value={yieldQuantity}
            onChange={(e) => setYieldQuantity(e.target.value)}
            data-testid="recipe-form-yield"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Unidad de rendimiento</Label>
          <Select value={yieldUnit} onValueChange={(v) => setYieldUnit(v as RecipeYieldUnit)}>
            <SelectTrigger data-testid="recipe-form-yield-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECIPE_YIELD_UNITS.map((u) => (
                <SelectItem key={u} value={u} data-testid={`recipe-form-yield-unit-option-${u}`}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-waste">Merma (%)</Label>
          <Input
            id="rec-waste"
            type="number"
            step="0.01"
            min="0"
            max="99.99"
            value={wastePercent}
            onChange={(e) => setWastePercent(e.target.value)}
            data-testid="recipe-form-waste"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-prep">Tiempo de preparación (min)</Label>
          <Input id="rec-prep" type="number" min="0" value={prepTimeMinutes} onChange={(e) => setPrepTimeMinutes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-bake">Tiempo de horneado (min)</Label>
          <Input id="rec-bake" type="number" min="0" value={bakeTimeMinutes} onChange={(e) => setBakeTimeMinutes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-category">Categoría</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="rec-category" data-testid="recipe-form-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} data-testid={`recipe-form-category-option-${c.id}`}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="rec-desc">Descripción</Label>
          <Textarea id="rec-desc" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="rec-instr">Instrucciones</Label>
          <Textarea id="rec-instr" value={instructions ?? ""} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <ImageUrlField
            id="rec-image"
            value={imageUrl ?? ""}
            onChange={setImageUrl}
            testId="recipe-form-image-url"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Ingredientes de la receta</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addLine("ingredient")}
              data-testid="recipe-form-add-ingredient"
            >
              + Ingrediente
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addLine("sub_recipe")}
              data-testid="recipe-form-add-subrecipe"
            >
              + Sub-receta
            </Button>
          </div>
        </div>

        {lines.length === 0 && <p className="text-sm text-muted-foreground">Agrega al menos un ingrediente o sub-receta.</p>}

        {lines.map((line, index) => (
          <div
            key={line.key}
            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
            data-testid="recipe-form-line"
            data-line-index={index}
          >
            <div className="flex-1">
              {line.kind === "ingredient" ? (
                <>
                  <Label className="mb-1 block text-xs">Ingrediente</Label>
                  <IngredientPicker
                    ingredients={ingredients}
                    value={ingredientById.get(line.ingredientId) ?? null}
                    onSelect={(ing) => updateLine(line.key, { ingredientId: ing.id, ingredientName: ing.name })}
                    onIngredientCreated={(ing) => setIngredients((prev) => [...prev, ing])}
                  />
                </>
              ) : (
                <>
                  <Label className="mb-1 block text-xs">Sub-receta (receta)</Label>
                  <Select value={line.subRecipeId} onValueChange={(v) => updateLine(line.key, { subRecipeId: v })}>
                    <SelectTrigger data-testid="recipe-form-subrecipe-select">
                      <SelectValue placeholder="Elige una receta" />
                    </SelectTrigger>
                    <SelectContent>
                      {subRecipeOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id} data-testid={`recipe-form-subrecipe-option-${r.id}`}>
                          {r.name} (receta)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div className="w-full sm:w-28">
              <Label className="mb-1 block text-xs">Cantidad</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                required
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                data-testid="recipe-form-line-quantity"
              />
            </div>
            <div className="w-full sm:w-32">
              <Label className="mb-1 block text-xs">Unidad</Label>
              <Select value={line.unit} onValueChange={(v) => updateLine(line.key, { unit: v as RecipeIngredientUnit })}>
                <SelectTrigger data-testid="recipe-form-line-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPE_INGREDIENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} data-testid={`recipe-form-line-unit-option-${u}`}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeLine(line.key)}
              data-testid="recipe-form-line-remove"
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="recipe-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} data-testid="recipe-form-cancel">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="recipe-form-submit">
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear receta"}
        </Button>
      </div>
    </form>
  );
}
