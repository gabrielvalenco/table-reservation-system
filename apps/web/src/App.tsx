import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createReservation, getAvailability } from "./api";
import { errorMessage } from "./errors";
import { addDays, formatDate, formatTime, todayInSaoPaulo } from "./format";

export function App() {
  const today = todayInSaoPaulo();
  const [date, setDate] = useState(today);
  const [partySize, setPartySize] = useState(2);
  const [slot, setSlot] = useState<string | null>(null);

  const availability = useQuery({
    queryKey: ["availability", date, partySize],
    queryFn: () => getAvailability(date, partySize),
    enabled: Number.isInteger(partySize) && partySize >= 1 && partySize <= 50 && Boolean(date),
  });

  const reserve = useMutation({
    mutationFn: createReservation,
    onError: () => {
      setSlot(null);
      void availability.refetch();
    },
  });

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

  if (reserve.isSuccess) {
    return (
      <main>
        <h1>Reserva confirmada</h1>
        <p role="status">
          Mesa para {reserve.data.partySize} {reserve.data.partySize === 1 ? "pessoa" : "pessoas"},{" "}
          {formatDate(reserve.data.startsAt)} às {formatTime(reserve.data.startsAt)}.
        </p>
        <button
          type="button"
          onClick={() => {
            reserve.reset();
            setSlot(null);
          }}
        >
          Fazer outra reserva
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Reservar uma mesa</h1>

      <section aria-labelledby="quando">
        <h2 id="quando">Quando</h2>
        <label>
          Data
          <input
            type="date"
            value={date}
            min={today}
            max={addDays(today, 30)}
            onChange={(event) => {
              setDate(event.target.value);
              setSlot(null);
            }}
          />
        </label>
        <label>
          Pessoas
          <input
            type="number"
            inputMode="numeric"
            value={partySize}
            min={1}
            max={50}
            onChange={(event) => {
              setPartySize(Number(event.target.value));
              setSlot(null);
            }}
          />
        </label>
      </section>

      <section aria-labelledby="horarios" aria-live="polite">
        <h2 id="horarios">Horários livres</h2>
        {availability.isPending && availability.fetchStatus !== "idle" && <p>Carregando…</p>}
        {availability.isError && <p role="alert">{errorMessage(availability.error)}</p>}
        {availability.isSuccess && availability.data.slots.length === 0 && (
          <p>Nenhum horário livre nesse dia para {partySize} pessoas.</p>
        )}
        {availability.isSuccess && (
          <ul className="slots">
            {availability.data.slots.map((iso) => (
              <li key={iso}>
                <button type="button" aria-pressed={slot === iso} onClick={() => setSlot(iso)}>
                  {formatTime(iso)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {slot && (
        <form onSubmit={onSubmit}>
          <h2>Seus dados</h2>
          <label>
            Nome
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            Telefone
            <input name="phone" type="tel" autoComplete="tel" required />
          </label>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Observações (opcional)
            <textarea name="notes" maxLength={500} rows={3} />
          </label>
          {reserve.isError && <p role="alert">{errorMessage(reserve.error)}</p>}
          <button type="submit" disabled={reserve.isPending}>
            {reserve.isPending ? "Reservando…" : `Reservar às ${formatTime(slot)}`}
          </button>
        </form>
      )}
    </main>
  );
}
