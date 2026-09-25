import * as React from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface Quote {
  buy: string;
  sell: string;
  source: string;
}
export interface ExchangeRate {
  currency: string;
  official: Quote;
  parallel: Quote | null;
  updatedAt: string;
  stale: boolean;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function Row({ label, q, testid }: { label: string; q: Quote; testid: string }) {
  return (
    <div data-testid={testid} className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">Compra</span> Bs {q.buy}
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Venta</span> Bs {q.sell}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{q.source}</span>
    </div>
  );
}

export function ExchangeRateCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [data, setData] = React.useState<ExchangeRate | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<ExchangeRate>("/exchange-rate")
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      data-testid="exchange-rate-card"
      className={cn("rounded-xl border bg-card/90 text-card-foreground shadow-sm", compact ? "p-3" : "p-4", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="currency_exchange" size={18} className="text-primary" />
          Dólar (USD) en Bs
        </span>
        {data?.stale && (
          <span data-testid="exchange-rate-stale" className="text-xs text-muted-foreground">
            dato no actualizado
          </span>
        )}
      </div>
      {data ? (
        <div className="flex flex-col gap-2">
          <Row label="Oficial" q={data.official} testid="exchange-rate-official" />
          {data.parallel && <Row label="Paralelo" q={data.parallel} testid="exchange-rate-parallel" />}
          <span data-testid="exchange-rate-updated" className="text-xs text-muted-foreground">
            Actualizado: {formatTime(data.updatedAt)}
          </span>
        </div>
      ) : failed ? (
        <p data-testid="exchange-rate-error" className="text-xs text-muted-foreground">
          Cotización no disponible por ahora.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Cargando cotización…</p>
      )}
    </div>
  );
}
