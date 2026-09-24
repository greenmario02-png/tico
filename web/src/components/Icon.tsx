import type * as React from "react";
import { cn } from "@/lib/utils";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Nombre del glifo de Material Symbols (Outlined), p. ej. "inventory_2". */
  name: string;
  /** Tamaño en px del ícono (por defecto 20). */
  size?: number;
  /** Si es true, usa la variante "filled" del glifo (peso visual mayor). */
  filled?: boolean;
}

// Envoltorio único para Material Symbols (Google Fonts, self-hosted vía el
// paquete npm `material-symbols`) para que toda la app use la misma familia
// de íconos de forma consistente (nav, botones, badges, stat cards, etc.)
// en lugar de emojis o íconos ad-hoc. Ver src/index.css para el @font-face.
export function Icon({ name, size = 20, filled = false, className, style, ...props }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined leading-none select-none", className)}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
