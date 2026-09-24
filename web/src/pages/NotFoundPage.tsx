import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center" data-testid="not-found-page">
      <div className="anim-float rounded-3xl bg-white/85 p-3 shadow-sm">
        <img src="/illustrations/not-found.svg" alt="" className="h-64 w-auto max-w-full sm:h-80" draggable={false} />
      </div>
      <div className="anim-fade-up">
        <h1 className="text-2xl font-semibold">Ups, no encontramos esa página</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Puede que el enlace esté mal escrito o que la página ya no exista. Volvamos a la cocina.
        </p>
      </div>
      <div className="anim-fade-up flex flex-wrap justify-center gap-3" style={{ ["--delay" as string]: "100ms" }}>
        <Button asChild data-testid="not-found-home">
          <Link to="/">Volver al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/recetas">Ir a Recetas</Link>
        </Button>
      </div>
    </div>
  );
}
