import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onValueChange?: (value: number) => void;
}

// Slider simple basado en <input type="range"> (SDD-08 §11.1: slider de
// margen). Evitamos sumar @radix-ui/react-slider solo para esto.
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className, onValueChange, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn(
      "h-2 w-full cursor-pointer appearance-none rounded-full bg-accent accent-primary",
      className,
    )}
    onChange={(e) => onValueChange?.(Number(e.target.value))}
    {...props}
  />
));
Slider.displayName = "Slider";

export { Slider };
