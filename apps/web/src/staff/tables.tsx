import type { StaffReservation, StaffTable } from "@reservas/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createTable, listTables, updateTable } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/errors";
import { formatShortDate, formatTime, people } from "@/format";

export function TablesPage() {
  const queryClient = useQueryClient();
  const tables = useQuery({ queryKey: ["staff-tables"], queryFn: listTables });
  const [editing, setEditing] = useState<StaffTable | "new" | null>(null);
  const [affected, setAffected] = useState<{ table: StaffTable; reservations: StaffReservation[] } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-tables"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-reservations"] });
    void queryClient.invalidateQueries({ queryKey: ["config"] });
  };

  const toggle = useMutation({
    mutationFn: (table: StaffTable) => updateTable(table.id, { active: !table.active }),
    onSuccess: ({ table, affectedReservations }) => {
      setAffected(affectedReservations.length > 0 ? { table, reservations: affectedReservations } : null);
      refresh();
    },
  });

  const list = tables.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium">Mesas</h1>
          <p className="text-muted-foreground mt-1">
            Mesas não são apagadas: ao desativar, ela deixa de receber reservas novas e as já feitas continuam na agenda.
          </p>
        </div>
        <Button size="lg" onClick={() => setEditing("new")}>
          <Plus /> Nova mesa
        </Button>
      </div>

      {(tables.isError || toggle.isError) && (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(tables.error ?? toggle.error)}
        </p>
      )}

      {affected && (
        <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-4">
          <p className="font-medium">
            A mesa {affected.table.number} tem {affected.reservations.length}{" "}
            {affected.reservations.length === 1 ? "reserva futura" : "reservas futuras"} que precisam de outra mesa:
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {affected.reservations.map((reservation) => (
              <li key={reservation.id}>
                {formatShortDate(reservation.startsAt)} às {formatTime(reservation.startsAt)} · {reservation.name} ·{" "}
                {people(reservation.partySize)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-sm">Troque a mesa delas na agenda.</p>
        </div>
      )}

      {tables.isPending ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((table) => (
            <li key={table.id} className="bg-card/80 border-border rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-3xl">Mesa {table.number}</p>
                  <p className="text-muted-foreground text-sm">{table.capacity} lugares</p>
                </div>
                <Badge variant={table.active ? "default" : "secondary"} className="font-sans font-medium">
                  {table.active ? "Ativa" : "Desativada"}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                {table.upcomingReservations === 0
                  ? "Sem reservas futuras"
                  : `${table.upcomingReservations} ${table.upcomingReservations === 1 ? "reserva futura" : "reservas futuras"}`}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(table)}>
                  Editar
                </Button>
                <Button variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(table)}>
                  {table.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nova mesa" : `Editar mesa ${editing?.number ?? ""}`}</DialogTitle>
            <DialogDescription>O número identifica a mesa no salão e não pode se repetir.</DialogDescription>
          </DialogHeader>
          {editing && (
            <TableForm
              key={editing === "new" ? "new" : editing.id}
              table={editing === "new" ? undefined : editing}
              onDone={(result) => {
                setEditing(null);
                setAffected(result && result.reservations.length > 0 ? result : null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableForm({
  table,
  onDone,
}: {
  table: StaffTable | undefined;
  onDone: (result: { table: StaffTable; reservations: StaffReservation[] } | null) => void;
}) {
  const save = useMutation({
    mutationFn: async (values: { number: number; capacity: number }) => {
      if (!table) return { table: await createTable(values), reservations: [] };
      const result = await updateTable(table.id, values);
      return { table: result.table, reservations: result.affectedReservations };
    },
    onSuccess: onDone,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({ number: Number(form.get("number")), capacity: Number(form.get("capacity")) });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="t-number">Número</Label>
          <Input id="t-number" name="number" type="number" min={1} max={9999} defaultValue={table?.number} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="t-capacity">Lugares</Label>
          <Input id="t-capacity" name="capacity" type="number" min={1} max={50} defaultValue={table?.capacity ?? 4} required />
        </div>
      </div>
      {save.isError && (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(save.error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : table ? "Salvar" : "Criar mesa"}
      </Button>
    </form>
  );
}
