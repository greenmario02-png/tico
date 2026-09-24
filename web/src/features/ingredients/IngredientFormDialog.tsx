import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { IngredientForm } from "./IngredientForm";
import type { Ingredient } from "@/lib/types";

export interface IngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ingredient: Ingredient) => void;
}

// Modal compacto de creación rápida de ingrediente (SDD-08 §3.2), usado
// desde el picker de ingredientes del formulario de recetas: "+ Crear
// ingrediente nuevo" abre esto sin salir de la pantalla de receta, y al
// guardar el nuevo ingrediente se agrega directamente a la línea que se
// estaba editando (ver RecipeIngredientPicker).
export function IngredientFormDialog({ open, onOpenChange, onCreated }: IngredientFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="ingredient-quick-create-dialog">
        <DialogHeader>
          <DialogTitle>Crear ingrediente nuevo</DialogTitle>
          <DialogDescription>Se agregará directamente a esta línea de la receta al guardar.</DialogDescription>
        </DialogHeader>
        <IngredientForm
          compact
          onSuccess={(ingredient) => {
            onCreated(ingredient);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
