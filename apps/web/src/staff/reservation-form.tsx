import type { ConfigResponse, StaffReservation, StaffTable } from "@reservas/shared";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { minutesOfDay, slotTimes } from "@/format";

export type ReservationValues = {
  name: string;
  phone: string;
  email: string;
  partySize: number;
  time: string;
  /** "auto" deixa o sistema escolher a menor mesa livre (só na criação). */
  tableId: string;
  notes: string;
};

export const clockOf = (iso: string) => {
  const minutes = minutesOfDay(iso);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

type Props = {
  config: ConfigResponse;
  tables: StaffTable[];
  /** Presente na edição. */
  reservation?: StaffReservation;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: ReservationValues) => void;
};

export function ReservationForm({ config, tables, reservation, pending, error, submitLabel, onSubmit }: Props) {
  const times = slotTimes(config);
  const initialTime = reservation ? clockOf(reservation.startsAt) : (times[0] ?? "19:00");
  const [time, setTime] = useState(initialTime);
  const [tableId, setTableId] = useState(reservation ? String(reservation.tableId) : "auto");

  const timeOptions = times.includes(time) ? times : [time, ...times];
  // Mesas desativadas só aparecem se for a mesa atual da reserva.
  const tableOptions = tables.filter((table) => table.active || table.id === reservation?.tableId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      name: String(form.get("name")).trim(),
      phone: String(form.get("phone")).trim(),
      email: String(form.get("email")).trim(),
      partySize: Number(form.get("partySize")),
      notes: String(form.get("notes") ?? "").trim(),
      time,
      tableId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="r-name">Nome</Label>
          <Input id="r-name" name="name" defaultValue={reservation?.name} required maxLength={100} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-phone">Telefone</Label>
          <Input id="r-phone" name="phone" type="tel" defaultValue={reservation?.phone} required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="r-email">E-mail</Label>
        <Input id="r-email" name="email" type="email" defaultValue={reservation?.email} required maxLength={254} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="r-party">Pessoas</Label>
          <Input id="r-party" name="partySize" type="number" min={1} max={50} defaultValue={reservation?.partySize ?? 2} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-time">Horário</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger id="r-time" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-table">Mesa</Label>
          <Select value={tableId} onValueChange={setTableId}>
            <SelectTrigger id="r-table" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!reservation && <SelectItem value="auto">Automática</SelectItem>}
              {tableOptions.map((table) => (
                <SelectItem key={table.id} value={String(table.id)}>
                  Mesa {table.number} ({table.capacity} lugares){table.active ? "" : " · desativada"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="r-notes">Observações</Label>
        <Textarea id="r-notes" name="notes" defaultValue={reservation?.notes ?? ""} maxLength={500} rows={2} />
      </div>

      {error && (
        <p role="alert" className="text-destructive font-medium">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
