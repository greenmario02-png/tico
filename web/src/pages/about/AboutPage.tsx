import { BakerMascot } from "@/components/mascot/BakerMascot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VERSION = "1.0.0";

const TECH: { group: string; items: string[] }[] = [
  { group: "Web", items: ["React", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui"] },
  { group: "Móvil", items: ["Flutter"] },
  { group: "Backend", items: ["Node.js", "Fastify", "Drizzle ORM", "PostgreSQL"] },
];

const CREDITS: { label: string; name: string; href?: string; testid: string }[] = [
  { label: "Ilustraciones (404 y estados vacíos)", name: "Storyset", href: "https://storyset.com", testid: "about-credit-storyset" },
  { label: "Íconos", name: "Google Material Symbols", href: "https://fonts.google.com/icons", testid: "about-credit-icons" },
  { label: "Fotografías de recetas e ingredientes", name: "Wikimedia Commons, licencias libres", href: "https://commons.wikimedia.org", testid: "about-credit-photos" },
  { label: "Mascota panadero", name: "Diseño propio", testid: "about-credit-mascot" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5" data-testid="about-page">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <BakerMascot state="idle" className="h-36 w-36" />
          <h1 className="text-2xl font-semibold">Panadería — Costeo e Inventario</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Sistema para costear recetas, controlar inventario y registrar la producción y ventas de una panadería en Bolivia.
          </p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium" data-testid="about-version">
            Versión {VERSION}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desarrollador</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium" data-testid="about-developer">Alvaro Diaz Vallejos — Karma.py</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tecnologías</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {TECH.map((t) => (
            <div key={t.group} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm text-muted-foreground">{t.group}</span>
              {t.items.map((i) => (
                <span key={i} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium">{i}</span>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créditos de recursos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {CREDITS.map((c) => (
              <li key={c.testid} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:justify-between">
                <span className="text-muted-foreground">{c.label}</span>
                {c.href ? (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={c.testid}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </a>
                ) : (
                  <span className="font-medium" data-testid={c.testid}>{c.name}</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">© 2026 Karma.py. Todos los derechos reservados.</p>
    </div>
  );
}
