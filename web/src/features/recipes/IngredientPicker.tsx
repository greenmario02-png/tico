import * as React from "react";
import type { Ingredient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { IngredientFormDialog } from "@/features/ingredients/IngredientFormDialog";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

export interface IngredientPickerProps {
  ingredients: Ingredient[];
  value: Ingredient | null;
  onSelect: (ingredient: Ingredient) => void;
  onIngredientCreated: (ingredient: Ingredient) => void;
}

// Picker de ingrediente para una línea de receta. Si la búsqueda no
// encuentra el ingrediente, ofrece "+ Crear ingrediente nuevo" que abre el
// modal compacto (IngredientFormDialog) sin salir del formulario de receta
// — al crear, el nuevo ingrediente se selecciona automáticamente en esta
// línea (requisito explícito de UX de la Fase 5).
export function IngredientPicker({ ingredients, value, onSelect, onIngredientCreated }: IngredientPickerProps) {
  const [query, setQuery] = React.useState(value?.name ?? "");
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = ingredients.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={containerRef} data-testid="ingredient-picker">
      <Input
        placeholder="Buscar ingrediente…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        data-testid="ingredient-picker-search"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md">
          {filtered.map((i) => (
            <button
              type="button"
              key={i.id}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-accent",
                value?.id === i.id && "bg-accent",
              )}
              onClick={() => {
                onSelect(i);
                setQuery(i.name);
                setOpen(false);
              }}
              data-testid="ingredient-picker-option"
              data-ingredient-name={i.name}
            >
              {i.name} <span className="text-muted-foreground">({i.baseUnit})</span>
            </button>
          ))}
          <button
            type="button"
            className="block w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
            onClick={() => {
              setCreateOpen(true);
              setOpen(false);
            }}
            data-testid="ingredient-picker-create-new"
          >
            <Icon name="add" size={16} className="mr-1 align-text-bottom" />
            Crear ingrediente nuevo{query ? `: "${query}"` : ""}
          </button>
        </div>
      )}

      <IngredientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ingredient) => {
          onIngredientCreated(ingredient);
          onSelect(ingredient);
          setQuery(ingredient.name);
        }}
      />
    </div>
  );
}
