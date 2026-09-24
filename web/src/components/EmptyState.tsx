import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  illustration?: "shelf" | "box";
  title: string;
  description?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
}

// Estado vacío reutilizable: ilustración (Storyset, sobre una superficie
// suave para que no desentone en modo oscuro) + texto + acción opcional.
export function EmptyState({
  illustration = "shelf",
  title,
  description,
  action,
  compact,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "anim-fade-up flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
      data-testid={rest["data-testid"]}
    >
      <div className="anim-float rounded-2xl bg-white/85 p-2 shadow-sm">
        <img
          src={`/illustrations/${illustration === "box" ? "empty-box" : "empty-shelf"}.svg`}
          alt=""
          className={compact ? "h-28 w-auto" : "h-40 w-auto"}
          draggable={false}
        />
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action &&
        (action.to ? (
          <Button asChild size="sm">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
