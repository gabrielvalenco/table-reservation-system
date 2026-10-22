// Demonstração: N pessoas tentam reservar a única mesa de 8 lugares no mesmo horário.
// Só uma pode conseguir. Requer a API no ar e o banco com `npm run db:seed`.
const apiUrl = process.env.API_URL ?? "http://localhost:3000";
// 10 é o limite de reservas por minuto por IP da API (rate limit): mais que isso volta 429 e não prova nada.
const attempts = Number(process.argv[2] ?? 10);

const timeZone = "America/Sao_Paulo";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });

// Um dia aberto (não é segunda) sorteado nos próximos 25 dias, para a demonstração poder rodar várias vezes.
function nextOpenDay() {
  const day = new Date(Date.now() + (3 + Math.floor(Math.random() * 22)) * 24 * 60 * 60 * 1000);
  while (weekdayFormat.format(day) === "Mon") day.setDate(day.getDate() + 1);
  return dayFormat.format(day);
}

const startsAt = `${nextOpenDay()}T19:00:00-03:00`;

console.log(`${attempts} pedidos simultâneos para ${startsAt}, grupo de 8 pessoas (só existe 1 mesa assim)...`);

const started = performance.now();
const responses = await Promise.all(
  Array.from({ length: attempts }, (_, index) =>
    fetch(`${apiUrl}/api/reservations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Demo ${index + 1}`,
        phone: "(11) 91234-5678",
        email: `demo${index + 1}@example.com`,
        partySize: 8,
        startsAt,
      }),
    }),
  ),
);
const elapsed = Math.round(performance.now() - started);

const byStatus = new Map<number, number>();
for (const response of responses) byStatus.set(response.status, (byStatus.get(response.status) ?? 0) + 1);

console.log(`Resultado em ${elapsed} ms:`);
for (const [status, count] of [...byStatus].sort()) {
  const meaning = status === 201 ? "reserva criada" : status === 409 ? "mesa ocupada" : status === 429 ? "barrado pelo rate limit" : "outro";
  console.log(`  ${status} ${meaning}: ${count}`);
}

const created = byStatus.get(201) ?? 0;
const limited = byStatus.get(429) ?? 0;
if (limited > 0) console.warn(`Aviso: ${limited} pedidos foram barrados pelo rate limit (10 por minuto por IP). Espere 1 minuto ou use menos pedidos.`);
if (created > 1) {
  console.error("FALHA: mais de uma reserva para a mesma mesa e horário!");
  process.exit(1);
}
console.log(created === 1 ? "OK: exatamente 1 reserva criada." : "Nenhuma criada: a mesa já estava ocupada nesse horário.");
