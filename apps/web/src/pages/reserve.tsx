import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleCheck, Minus, Moon, Plus, Sun, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createReservation, getAvailability } from "./api";
import { DatePicker } from "./components/date-picker";
import { Logo, Ornament, PlaceSetting, Wordmark } from "./components/ornaments";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { errorMessage } from "./errors";
import { addDays, formatDate, formatTime, isLunch, todayInSaoPaulo } from "./format";
import { cn } from "./lib/utils";

// Espelha rules.closedWeekdays da API (segunda-feira); a API continua sendo quem decide.
const CLOSED_WEEKDAYS = [1];

const steps = ["Escolha o dia e quantas pessoas", "Veja os horários livres", "Confirme com seus dados"];

export function App() {
  const today = todayInSaoPaulo();
  const [date, setDate] = useState(today);
  const [partySize, setPartySize] = useState(2);
  const [slot, setSlot] = useState<string | null>(null);

  const availability = useQuery({
    queryKey: ["availability", date, partySize],
    queryFn: () => getAvailability(date, partySize),
    enabled: Boolean(date),
  });

  const reserve = useMutation({
    mutationFn: createReservation,
    onError: () => {
      setSlot(null);
      void availability.refetch();
    },
  });

  function changeParty(delta: number) {
    setPartySize((size) => Math.min(50, Math.max(1, size + delta)));
    setSlot(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;
    const form = new FormData(event.currentTarget);
    const notes = String(form.get("notes") ?? "").trim();
    reserve.mutate({
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      email: String(form.get("email")),
      partySize,
      startsAt: slot,
      ...(notes ? { notes } : {}),
    });
  }

  const slots = availability.data?.slots ?? [];
  const lunch = slots.filter(isLunch);
  const dinner = slots.filter((iso) => !isLunch(iso));
  const people = (count: number) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`;

  return (
    <div className="relative overflow-hidden">
      <header className="border-border/70 relative border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <Logo />
          <Wordmark />
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-12 px-5 pt-12 pb-24 lg:grid-cols-[1fr_28rem] lg:gap-20 lg:pt-20">
        <section className="relative">
          <p className="text-terracotta relative flex items-center gap-3 text-sm font-medium tracking-[0.3em] uppercase">
            <span className="bg-terracotta h-px w-10" aria-hidden="true" />
            Reservas online
          </p>
          <div className="relative mt-6 flex items-center justify-between gap-6">
            <h1 className="text-5xl leading-[1.05] font-medium md:text-7xl">
              Reserve
              <br />
              sua <em className="text-terracotta font-normal">mesa.</em>
            </h1>
            <PlaceSetting className="hidden size-36 shrink-0 sm:block md:size-44" />
          </div>
          <p className="text-muted-foreground relative mt-7 max-w-md text-lg leading-relaxed">
            Escolha o dia, o horário e quantas pessoas vêm. A gente deixa a melhor mesa pronta para você.
          </p>

          <Ornament className="mt-12 max-w-md" />

          <ol className="relative mt-6 max-w-md">
            {steps.map((label, index) => (
              <li key={label} className="border-border flex items-baseline gap-5 border-t py-4 last:border-b">
                <span className="font-display text-gold w-9 shrink-0 text-2xl italic">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-base font-medium">{label}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Reserva" className="relative">
          {reserve.isSuccess ? (
            <Confirmation
              summary={`Mesa para ${people(reserve.data.partySize)}, ${formatDate(reserve.data.startsAt)} às ${formatTime(reserve.data.startsAt)}.`}
              onReset={() => {
                reserve.reset();
                setSlot(null);
              }}
            />
          ) : (
            <div className="relative grid gap-6">
              <Card className="bg-card/90 border-border relative rounded-xl shadow-sm outline-gold/45 outline outline-1 -outline-offset-[7px] py-8">
                <CardHeader>
                  <CardTitle className="text-3xl font-medium">Quando?</CardTitle>
                  <CardDescription>Aceitamos reservas de hoje até 30 dias à frente.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="date">
                      <CalendarDays className="size-4" /> Data
                    </Label>
                    <DatePicker
                      id="date"
                      value={date}
                      min={today}
                      max={addDays(today, 30)}
                      disabled={{ dayOfWeek: CLOSED_WEEKDAYS }}
                      onChange={(value) => {
                        setDate(value);
                        setSlot(null);
                      }}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label id="party-label">
                      <Users className="size-4" /> Pessoas
                    </Label>
                    <div className="flex items-center gap-4" role="group" aria-labelledby="party-label">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        aria-label="Menos uma pessoa"
                        disabled={partySize <= 1}
                        onClick={() => changeParty(-1)}
                      >
                        <Minus />
                      </Button>
                      <output className="font-display w-10 text-center text-3xl font-medium" aria-live="polite">
                        {partySize}
                      </output>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        aria-label="Mais uma pessoa"
                        disabled={partySize >= 50}
                        onClick={() => changeParty(1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>

                  <div aria-live="polite" className="grid gap-5">
                    {availability.isPending && availability.fetchStatus !== "idle" && (
                      <p className="text-muted-foreground">Procurando mesas…</p>
                    )}
                    {availability.isError && (
                      <p role="alert" className="text-destructive font-medium">
                        {errorMessage(availability.error)}
                      </p>
                    )}
                    {availability.isSuccess && slots.length === 0 && (
                      <p className="text-muted-foreground">
                        Sem horários livres nesse dia para {people(partySize)}. Tente outra data.
                      </p>
                    )}
                    <SlotGroup title="Almoço" icon={<Sun className="size-4" />} slots={lunch} selected={slot} onSelect={setSlot} />
                    <SlotGroup title="Jantar" icon={<Moon className="size-4" />} slots={dinner} selected={slot} onSelect={setSlot} />
                  </div>
                </CardContent>
              </Card>

              {slot && (
                <Card className="bg-card/90 border-border relative rounded-xl shadow-sm outline-gold/45 outline outline-1 -outline-offset-[7px] py-8">
                  <form onSubmit={onSubmit}>
                    <CardHeader className="mb-5">
                      <CardTitle className="text-3xl font-medium">Seus dados</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-sans font-medium">
                          {formatDate(slot)}, {formatTime(slot)}
                        </Badge>
                        <span>para {people(partySize)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <Field id="name" label="Nome">
                        <Input id="name" name="name" autoComplete="name" required maxLength={100} className="bg-background/60 h-11" />
                      </Field>
                      <Field id="phone" label="Telefone">
                        <Input id="phone" name="phone" type="tel" autoComplete="tel" required className="bg-background/60 h-11" />
                      </Field>
                      <Field id="email" label="E-mail">
                        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="bg-background/60 h-11" />
                      </Field>
                      <Field id="notes" label="Observações (opcional)">
                        <Textarea id="notes" name="notes" maxLength={500} rows={3} className="bg-background/60" />
                      </Field>
                      {reserve.isError && (
                        <p role="alert" className="text-destructive font-medium">
                          {errorMessage(reserve.error)}
                        </p>
                      )}
                      <Button type="submit" size="lg" disabled={reserve.isPending} className="mt-2 h-12 w-full text-base">
                        {reserve.isPending ? "Reservando…" : `Confirmar reserva às ${formatTime(slot)}`}
                      </Button>
                    </CardContent>
                  </form>
                </Card>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="text-muted-foreground border-border/70 relative border-t px-5 py-8 text-center text-sm">
        Pincelada · Cozinha de autor · Horários em Brasília
      </footer>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SlotGroup({
  title,
  icon,
  slots,
  selected,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  slots: string[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div className="grid gap-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium tracking-[0.2em] uppercase">
        {icon} {title}
      </h3>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {slots.map((iso) => {
          const active = selected === iso;
          return (
            <li key={iso}>
              <Button
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => onSelect(iso)}
                className={cn("h-11 w-full text-base tabular-nums", !active && "bg-background/60")}
              >
                {formatTime(iso)}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Confirmation({ summary, onReset }: { summary: string; onReset: () => void }) {
  return (
    <Card className="bg-card/90 border-border relative rounded-xl shadow-sm outline-gold/45 outline outline-1 -outline-offset-[7px] py-8">
      <CardHeader>
        <CircleCheck className="text-forest mb-2 size-10" strokeWidth={1.5} aria-hidden="true" />
        <CardTitle className="text-4xl font-medium">Reserva confirmada</CardTitle>
        <CardDescription role="status" className="text-base">
          {summary} Esperamos você.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="lg" onClick={onReset}>
          Fazer outra reserva
        </Button>
      </CardContent>
    </Card>
  );
}
