import type { ReservationStatus } from "@reservas/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { getStats } from "@/api";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/errors";
import { people } from "@/format";
import { cn } from "@/lib/utils";
import { statusLabel } from "./agenda";

const periods = [7, 30, 90];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

export function StatsPage() {
  const [days, setDays] = useState(30);
  const stats = useQuery({ queryKey: ["staff-stats", days], queryFn: () => getStats(days) });
  const data = stats.data;

  const maxShift = Math.max(1, ...(data?.byShift.map((item) => item.reservations) ?? []));
  const maxWeekday = Math.max(1, ...(data?.byWeekday.map((item) => item.reservations) ?? []));

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium">Painel</h1>
          <p className="text-muted-foreground mt-1">Reservas dos últimos {days} dias, até agora.</p>
        </div>
        <div role="group" aria-label="Período" className="flex gap-2">
          {periods.map((period) => (
            <Button key={period} variant={days === period ? "default" : "outline"} aria-pressed={days === period} onClick={() => setDays(period)}>
              {period} dias
            </Button>
          ))}
        </div>
      </div>

      {stats.isError && (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(stats.error)}
        </p>
      )}
      {stats.isPending && <p className="text-muted-foreground">Carregando…</p>}

      {data && (
        <>
          <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Não comparecimento" value={percent(data.noShowRate)} hint="entre reservas já encerradas" />
            <Metric label="Cancelamento" value={percent(data.cancellationRate)} hint="de todas as reservas" />
            {(["completed", "no_show"] as ReservationStatus[]).map((key) => (
              <Metric key={key} label={statusLabel[key]} value={String(data.totals[key])} hint={data.totals[key] === 1 ? "reserva" : "reservas"} />
            ))}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-label="Por turno">
              <h2 className="text-2xl font-medium">Por turno</h2>
              <ul className="mt-4 grid gap-4">
                {data.byShift.map((item) => (
                  <Bar
                    key={item.shift}
                    label={item.shift === "lunch" ? "Almoço" : "Jantar"}
                    value={item.reservations}
                    max={maxShift}
                    detail={`${item.reservations} ${item.reservations === 1 ? "reserva" : "reservas"} · ${people(item.guests)}`}
                  />
                ))}
              </ul>
            </section>

            <section aria-label="Por dia da semana">
              <h2 className="text-2xl font-medium">Por dia da semana</h2>
              <ul className="mt-4 grid gap-4">
                {weekdays.map((label, index) => {
                  const value = data.byWeekday.find((item) => item.weekday === index)?.reservations ?? 0;
                  return <Bar key={label} label={label} value={value} max={maxWeekday} detail={String(value)} />;
                })}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="bg-card/80 border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-display mt-1 text-4xl">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}

function Bar({ label, value, max, detail }: { label: string; value: number; max: number; detail: string }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
      <span className="font-medium">{label}</span>
      <span className="bg-muted h-3 overflow-hidden rounded-full" role="presentation">
        <span className={cn("bg-forest block h-full rounded-full", value === 0 && "w-0")} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="text-muted-foreground tabular-nums">{detail}</span>
    </li>
  );
}
