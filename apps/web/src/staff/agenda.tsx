import type { ConfigResponse, ReservationStatus, StaffReservation, StaffTable } from "@reservas/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, UserX } from "lucide-react";
import { useDeferredValue, useState } from "react";
import {
  createStaffReservation,
  getConfig,
  listReservations,
  listTables,
  updateReservation,
} from "@/api";
import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/errors";
import { addDays, formatShortDate, formatTime, minutesOfDay, people, todayInSaoPaulo, zonedIso } from "@/format";
import { cn } from "@/lib/utils";
import { ReservationForm, type ReservationValues } from "./reservation-form";

export const statusLabel: Record<ReservationStatus, string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
  no_show: "Não compareceu",
};

const statusStyle: Record<ReservationStatus, string> = {
  confirmed: "bg-forest text-primary-foreground",
  completed: "bg-gold text-white",
  no_show: "bg-terracotta text-white",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function AgendaPage() {
  const queryClient = useQueryClient();
  const today = todayInSaoPaulo();
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const searching = q.length > 0;

  const [editing, setEditing] = useState<StaffReservation | null>(null);
  const [creating, setCreating] = useState(false);

  const config = useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: 5 * 60_000 });
  const tables = useQuery({ queryKey: ["staff-tables"], queryFn: listTables });
  const filter = { status: status === "all" ? undefined : status, ...(searching ? { q } : { date }) };
  const reservations = useQuery({
    queryKey: ["staff-reservations", filter],
    queryFn: () => listReservations(filter),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-reservations"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-tables"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "completed" | "no_show" }) =>
      updateReservation(id, { status }),
    onSuccess: refresh,
  });

  const rows = reservations.data ?? [];
  const active = rows.filter((row) => row.status !== "cancelled");
  const guests = active.reduce((total, row) => total + row.partySize, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium">Agenda</h1>
          <p className="text-muted-foreground mt-1">
            {searching ? "Resultado da busca em todas as datas." : `${people(guests)} em ${active.length} ${active.length === 1 ? "reserva" : "reservas"} neste dia.`}
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)} disabled={!config.data || !tables.data}>
          <Plus /> Nova reserva
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="icon-lg" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))} disabled={searching}>
            <ChevronLeft />
          </Button>
          <div className="w-72 shrink-0">
            <DatePicker value={date} onChange={setDate} />
          </div>
          <Button variant="outline" size="icon-lg" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))} disabled={searching}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" onClick={() => setDate(today)} disabled={searching || date === today}>
            Hoje
          </Button>
        </div>

        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Buscar por nome, e-mail ou telefone"
            placeholder="Buscar por nome, e-mail ou telefone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 pl-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar por status" className="h-11 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabel) as ReservationStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {statusLabel[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(reservations.isError || changeStatus.isError) && (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(reservations.error ?? changeStatus.error)}
        </p>
      )}

      {!searching && config.data && tables.data && (
        <Timeline config={config.data} tables={tables.data} reservations={active} onSelect={setEditing} />
      )}

      {reservations.isPending ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{searching ? "Nada encontrado." : "Nenhuma reserva neste dia."}</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <ReservationRow
              key={row.id}
              reservation={row}
              showDate={searching}
              busy={changeStatus.isPending}
              onEdit={() => setEditing(row)}
              onStatus={(next) => changeStatus.mutate({ id: row.id, status: next })}
            />
          ))}
        </ul>
      )}

      {config.data && tables.data && (
        <>
          <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Editar reserva</DialogTitle>
                <DialogDescription>Mudanças de mesa e horário só valem se a mesa estiver livre.</DialogDescription>
              </DialogHeader>
              {editing && (
                <EditReservation
                  key={editing.id}
                  reservation={editing}
                  config={config.data}
                  tables={tables.data}
                  onDone={() => {
                    setEditing(null);
                    refresh();
                  }}
                />
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nova reserva</DialogTitle>
                <DialogDescription>Para o dia {formatShortDate(zonedIso(date, "12:00"))}. A equipe pode reservar com pouca antecedência.</DialogDescription>
              </DialogHeader>
              {creating && (
                <CreateReservation
                  date={date}
                  config={config.data}
                  tables={tables.data}
                  onDone={() => {
                    setCreating(false);
                    refresh();
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function ReservationRow({
  reservation,
  showDate,
  busy,
  onEdit,
  onStatus,
}: {
  reservation: StaffReservation;
  showDate: boolean;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: "cancelled" | "completed" | "no_show") => void;
}) {
  const confirmed = reservation.status === "confirmed";
  return (
    <li className="bg-card/80 border-border flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-4">
      <div className="w-24">
        {showDate && <p className="text-muted-foreground text-xs capitalize">{formatShortDate(reservation.startsAt)}</p>}
        <p className="font-display text-2xl tabular-nums">{formatTime(reservation.startsAt)}</p>
      </div>
      <div className="min-w-48 flex-1">
        <p className="font-medium">{reservation.name}</p>
        <p className="text-muted-foreground text-sm">
          {people(reservation.partySize)} · Mesa {reservation.tableNumber}
          {!reservation.tableActive && <span className="text-destructive"> (mesa desativada)</span>}
        </p>
        <p className="text-muted-foreground text-sm">
          {reservation.phone || "—"} · {reservation.email || "—"}
        </p>
        {reservation.notes && <p className="mt-1 text-sm italic">“{reservation.notes}”</p>}
      </div>
      <Badge variant={confirmed ? "default" : "secondary"} className="font-sans font-medium">
        {statusLabel[reservation.status]}
        {reservation.status === "cancelled" && reservation.cancelledBy === "customer" && " (pelo cliente)"}
      </Badge>
      {confirmed && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil /> Editar
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus("completed")}>
            <Check /> Concluída
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus("no_show")}>
            <UserX /> Não veio
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            className="text-destructive"
            onClick={() => window.confirm(`Cancelar a reserva de ${reservation.name}? O cliente será avisado por e-mail.`) && onStatus("cancelled")}
          >
            <Ban /> Cancelar
          </Button>
        </div>
      )}
    </li>
  );
}

/** Uma linha por mesa e blocos de duração da reserva sobre o eixo de horas. */
function Timeline({
  config,
  tables,
  reservations,
  onSelect,
}: {
  config: ConfigResponse;
  tables: StaffTable[];
  reservations: StaffReservation[];
  onSelect: (reservation: StaffReservation) => void;
}) {
  const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  const first = Math.floor(Math.min(...config.shifts.map((shift) => toMinutes(shift.start))) / 60) * 60;
  const last = Math.ceil(Math.max(...config.shifts.map((shift) => toMinutes(shift.end))) / 60) * 60;
  const span = last - first;
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, index) => first / 60 + index);
  const percent = (minutes: number) => `${((minutes - first) / span) * 100}%`;

  // Mesas desativadas só aparecem se ainda tiverem reservas neste dia.
  const rows = tables.filter((table) => table.active || reservations.some((reservation) => reservation.tableId === table.id));

  return (
    <section aria-label="Linha do tempo das mesas" className="bg-card/80 border-border overflow-x-auto rounded-lg border">
      <div className="min-w-[44rem] p-4">
        <div className="grid grid-cols-[5.5rem_1fr] items-end">
          <div />
          <div className="relative h-6">
            {hours.map((hour) => (
              <span
                key={hour}
                className="text-muted-foreground absolute -translate-x-1/2 text-xs tabular-nums"
                style={{ left: percent(hour * 60) }}
              >
                {String(hour % 24).padStart(2, "0")}h
              </span>
            ))}
          </div>
        </div>

        {rows.map((table) => (
          <div key={table.id} className="border-border/60 grid grid-cols-[5.5rem_1fr] items-center border-t">
            <p className={cn("py-3 text-sm", !table.active && "text-muted-foreground")}>
              <span className="font-medium">Mesa {table.number}</span>
              <span className="text-muted-foreground block text-xs">{table.capacity} lugares</span>
            </p>
            <div className="relative h-12">
              {hours.map((hour) => (
                <span key={hour} className="bg-border/50 absolute top-0 h-full w-px" style={{ left: percent(hour * 60) }} aria-hidden="true" />
              ))}
              {reservations
                .filter((reservation) => reservation.tableId === table.id)
                .map((reservation) => {
                  const start = minutesOfDay(reservation.startsAt);
                  const end = start + config.durationMinutes;
                  return (
                    <button
                      key={reservation.id}
                      type="button"
                      onClick={() => reservation.status === "confirmed" && onSelect(reservation)}
                      title={`${formatTime(reservation.startsAt)} · ${reservation.name} · ${people(reservation.partySize)} · ${statusLabel[reservation.status]}`}
                      className={cn(
                        "absolute top-1.5 h-9 overflow-hidden rounded-md px-2 text-left text-xs leading-tight font-medium whitespace-nowrap",
                        statusStyle[reservation.status],
                        reservation.status === "confirmed" ? "cursor-pointer hover:brightness-110" : "cursor-default",
                      )}
                      style={{ left: percent(start), width: `calc(${percent(end)} - ${percent(start)} - 2px)` }}
                    >
                      <span className="block truncate">{reservation.name}</span>
                      <span className="block truncate opacity-80">{people(reservation.partySize)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EditReservation({
  reservation,
  config,
  tables,
  onDone,
}: {
  reservation: StaffReservation;
  config: ConfigResponse;
  tables: StaffTable[];
  onDone: () => void;
}) {
  const save = useMutation({
    mutationFn: (values: ReservationValues) => {
      const date = reservation.startsAt;
      const body: Parameters<typeof updateReservation>[1] = {};
      if (values.name !== reservation.name) body.name = values.name;
      if (values.phone !== reservation.phone) body.phone = values.phone;
      if (values.email !== reservation.email) body.email = values.email;
      if (values.partySize !== reservation.partySize) body.partySize = values.partySize;
      if (values.notes !== (reservation.notes ?? "")) body.notes = values.notes === "" ? null : values.notes;
      if (Number(values.tableId) !== reservation.tableId) body.tableId = Number(values.tableId);
      const newStart = zonedIso(new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(new Date(date)), values.time);
      if (new Date(newStart).getTime() !== new Date(reservation.startsAt).getTime()) body.startsAt = newStart;
      return Object.keys(body).length === 0 ? Promise.resolve(reservation) : updateReservation(reservation.id, body);
    },
    onSuccess: onDone,
  });

  return (
    <ReservationForm
      config={config}
      tables={tables}
      reservation={reservation}
      pending={save.isPending}
      error={save.isError ? errorMessage(save.error) : null}
      submitLabel="Salvar alterações"
      onSubmit={(values) => save.mutate(values)}
    />
  );
}

function CreateReservation({
  date,
  config,
  tables,
  onDone,
}: {
  date: string;
  config: ConfigResponse;
  tables: StaffTable[];
  onDone: () => void;
}) {
  const create = useMutation({
    mutationFn: (values: ReservationValues) =>
      createStaffReservation({
        name: values.name,
        phone: values.phone,
        email: values.email,
        partySize: values.partySize,
        startsAt: zonedIso(date, values.time),
        ...(values.notes ? { notes: values.notes } : {}),
        ...(values.tableId !== "auto" ? { tableId: Number(values.tableId) } : {}),
      }),
    onSuccess: onDone,
  });

  return (
    <ReservationForm
      config={config}
      tables={tables}
      pending={create.isPending}
      error={create.isError ? errorMessage(create.error) : null}
      submitLabel="Criar reserva"
      onSubmit={(values) => create.mutate(values)}
    />
  );
}
