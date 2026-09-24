import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityImage } from "@/components/EntityImage";

// Campo de formulario compartido para `imageUrl` (ingredientes y recetas).
// Campo nuevo agregado a pedido explícito del usuario, no contemplado en
// 01-PROJECT_SPEC.md / SDD original: URL opcional, con previsualización en
// vivo debajo del campo si no está vacía.

export interface ImageUrlFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  testId?: string;
}

export function ImageUrlField({ id, value, onChange, label = "URL de la imagen", testId }: ImageUrlFieldProps) {
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setLoadFailed(false);
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label} (opcional)</Label>
      <Input
        id={id}
        type="url"
        placeholder="https://..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      />
      {value.trim() !== "" && (
        <div className="flex items-center gap-3 pt-1">
          <EntityImage
            src={value}
            alt="Previsualización"
            className="h-16 w-16 rounded-md border border-border"
            fallbackIconSize={18}
            onLoadError={() => setLoadFailed(true)}
            onLoadSuccess={() => setLoadFailed(false)}
          />
          {loadFailed ? (
            <p className="text-xs text-destructive" data-testid={`${testId}-error`}>
              No se pudo cargar esa imagen. Verifica que la URL sea correcta.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Vista previa</p>
          )}
        </div>
      )}
    </div>
  );
}
