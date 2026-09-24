import * as React from "react";
import { ImageOff, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Componente compartido para mostrar la foto de un ingrediente/receta
// (campo `imageUrl`, agregado a pedido explícito del usuario — no forma
// parte de 01-PROJECT_SPEC.md ni del SDD original). Si no hay `src`, o si la
// URL no carga, se muestra un ícono de reemplazo en vez de un ícono de
// "imagen rota" del navegador.

export interface EntityImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Tamaño del ícono de reemplazo cuando no hay imagen o falla la carga. */
  fallbackIconSize?: number;
  /** Se llama cuando `src` no está vacío pero la imagen no pudo cargarse. */
  onLoadError?: () => void;
  /** Se llama cuando `src` carga correctamente (útil para limpiar un error previo). */
  onLoadSuccess?: () => void;
}

export function EntityImage({
  src,
  alt,
  className,
  fallbackIconSize = 20,
  onLoadError,
  onLoadSuccess,
}: EntityImageProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
        data-testid="entity-image-placeholder"
        title={src ? "No se pudo cargar la imagen" : "Sin imagen"}
      >
        {src ? <ImageOff size={fallbackIconSize} /> : <ImageIcon size={fallbackIconSize} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => {
        setFailed(true);
        onLoadError?.();
      }}
      onLoad={() => onLoadSuccess?.()}
      data-testid="entity-image"
    />
  );
}
