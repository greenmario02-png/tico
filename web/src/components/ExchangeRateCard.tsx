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
  parallel: Quote | null;
  updatedAt: string;
  stale: boolean;
}

// Intervalo aleatorio 5-10 min, recalculado en cada ciclo.
const nextDelay = () => 5 * 60 * 1000 + Math.random() * 5 * 60 * 1000;

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
    const load = () =>
      api
        .get<ExchangeRate>("/exchange-rate")
        .then((r) => {
          if (cancelled) return;
          setData(r);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        void load().finally(() => !cancelled && schedule());
      }, nextDelay());
    };
    void load();
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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
          {data.parallel ? (
            <Row label="Binance P2P" q={data.parallel} testid="exchange-rate-parallel" />
          ) : (
            <p data-testid="exchange-rate-error" className="text-xs text-muted-foreground">
              Cotización no disponible por ahora.
            </p>
          )}
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
