import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Minus, Plus, Sun, Moon, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createReservation, getAvailability } from "./api";
import { Logo, PaintFilters, Splatter, Wash } from "./components/ink";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { errorMessage } from "./errors";
import { addDays, formatDate, formatTime, isLunch, todayInSaoPaulo } from "./format";
import { cn } from "./lib/utils";

const paint = (color: string) => ({ ["--paint" as string]: color });

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

  return (
    <div className="relative overflow-hidden">
      <PaintFilters />
      <Splatter className="-top-16 -right-20 size-72 rotate-12 text-ochre/40 md:size-96" />
      <Splatter className="top-[55%] -left-24 size-64 -rotate-12 text-teal/25" />

      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
        <Logo />
        <div className="leading-tight">
          <p className="font-display text-xl font-bold">Pincelada</p>
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Cozinha de autor</p>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-10 px-5 pt-4 pb-20 lg:grid-cols-[1fr_28rem] lg:gap-16 lg:pt-12">
        <section className="relative">
          <Wash className="-top-6 -left-6 h-44 w-[110%] text-ochre/35" />
          <p className="text-primary relative font-semibold tracking-[0.25em] uppercase">Reservas</p>
          <h1 className="relative mt-3 text-5xl leading-[1.05] font-black md:text-7xl">
            Sua mesa,
            <br />
            <span className="brush-underline">pintada</span> para você.
          </h1>
          <p className="text-muted-foreground relative mt-6 max-w-md text-lg">
            Escolha o dia, o horário e quantas pessoas vêm. A gente reserva a melhor mesa e deixa tudo pronto.
          </p>

          <ul className="relative mt-10 grid max-w-md gap-4 text-sm">
            {[
              ["Escolha o dia e as pessoas", "var(--ochre)"],
              ["Veja os horários livres", "var(--teal)"],
              ["Confirme com seus dados", "var(--tomato)"],
            ].map(([label, color], index) => (
              <li key={label} className="flex items-center gap-4">
                <span
                  className="paint grid size-9 place-items-center rounded-full font-display text-lg font-bold text-white"
                  style={paint(color!)}
                >
                  {index + 1}
                </span>
                <span className="text-base font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Reserva" className="relative">
          {reserve.isSuccess ? (
            <Confirmation
              partySize={reserve.data.partySize}
              startsAt={reserve.data.startsAt}
              onReset={() => {
                reserve.reset();
                setSlot(null);
              }}
            />
          ) : (
            <div className="grid gap-8">
              <Card className="paint paint-card bg-transparent shadow-none" style={paint("var(--card)")}>
                <CardHeader>
                  <CardTitle className="text-2xl">Quando?</CardTitle>
                  <CardDescription>Aceitamos reservas de hoje até 30 dias à frente.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="date">
                      <CalendarDays className="size-4" /> Data
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      min={today}
                      max={addDays(today, 30)}
                      className="bg-background/70 h-11"
                      onChange={(event) => {
                        setDate(event.target.value);
                        setSlot(null);
                      }}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label id="party-label">
                      <Users className="size-4" /> Pessoas
                    </Label>
                    <div className="flex items-center gap-3" role="group" aria-labelledby="party-label">
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
                      <output className="font-display w-12 text-center text-3xl font-bold" aria-live="polite">
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

                  <div aria-live="polite" className="grid gap-4">
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
                        Sem horários livres nesse dia para {partySize} {partySize === 1 ? "pessoa" : "pessoas"}. Tente
                        outra data.
                      </p>
                    )}
                    <SlotGroup title="Almoço" icon={<Sun className="size-4" />} slots={lunch} selected={slot} onSelect={setSlot} />
                    <SlotGroup title="Jantar" icon={<Moon className="size-4" />} slots={dinner} selected={slot} onSelect={setSlot} />
                  </div>
                </CardContent>
              </Card>

              {slot && (
                <Card className="paint paint-card bg-transparent shadow-none" style={paint("var(--card)")}>
                  <form onSubmit={onSubmit}>
                    <CardHeader className="mb-5">
                      <CardTitle className="text-2xl">Seus dados</CardTitle>
                      <CardDescription>
                        <Badge variant="secondary" className="mr-1">
                          {formatDate(slot)}, {formatTime(slot)}
                        </Badge>
                        para {partySize} {partySize === 1 ? "pessoa" : "pessoas"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <Field id="name" label="Nome">
                        <Input id="name" name="name" autoComplete="name" required maxLength={100} className="bg-background/70 h-11" />
                      </Field>
                      <Field id="phone" label="Telefone">
                        <Input id="phone" name="phone" type="tel" autoComplete="tel" required className="bg-background/70 h-11" />
                      </Field>
                      <Field id="email" label="E-mail">
                        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="bg-background/70 h-11" />
                      </Field>
                      <Field id="notes" label="Observações (opcional)">
                        <Textarea id="notes" name="notes" maxLength={500} rows={3} className="bg-background/70" />
                      </Field>
                      {reserve.isError && (
                        <p role="alert" className="text-destructive font-medium">
                          {errorMessage(reserve.error)}
                        </p>
                      )}
                      <Button
                        type="submit"
                        size="lg"
                        disabled={reserve.isPending}
                        className="paint mt-2 h-12 w-full bg-transparent text-base text-white hover:bg-transparent"
                        style={paint("var(--primary)")}
                      >
                        {reserve.isPending ? "Reservando…" : `Reservar às ${formatTime(slot)}`}
                      </Button>
                    </CardContent>
                  </form>
                </Card>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="text-muted-foreground relative border-t px-5 py-8 text-center text-sm">
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
    <div className="grid gap-2">
      <h3 className="flex items-center gap-2 text-base font-bold">
        {icon} {title}
      </h3>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {slots.map((iso) => {
          const active = selected === iso;
          return (
            <li key={iso}>
              <Button
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => onSelect(iso)}
                className={cn(
                  "h-11 w-full text-base",
                  active ? "paint bg-transparent text-white hover:bg-transparent" : "bg-card/80 hover:bg-ochre/30",
                )}
                style={active ? paint("var(--teal)") : undefined}
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

function Confirmation({ partySize, startsAt, onReset }: { partySize: number; startsAt: string; onReset: () => void }) {
  return (
    <Card className="paint paint-card relative overflow-visible bg-transparent shadow-none" style={paint("var(--card)")}>
      <Splatter className="-top-10 -right-8 size-40 text-tomato/35" />
      <CardHeader>
        <Badge className="paint w-fit -rotate-3 bg-transparent px-4 py-1 text-base text-white" style={paint("var(--teal)")}>
          Confirmada
        </Badge>
        <CardTitle className="mt-3 text-4xl">Mesa reservada!</CardTitle>
        <CardDescription role="status" className="text-base">
          Mesa para {partySize} {partySize === 1 ? "pessoa" : "pessoas"}, {formatDate(startsAt)} às {formatTime(startsAt)}.
          Esperamos você.
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
