import nodemailer from "nodemailer";
import { rules } from "./reservations/rules.js";

export type Email = {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export type Mailer = { send(email: Email): Promise<void> };

/** Sem SMTP configurado nada é enviado, e o log não leva dado pessoal. */
export function createMailer(smtpUrl: string | undefined, from: string, log: (message: string) => void): Mailer {
  if (!smtpUrl) {
    return { send: async () => log("SMTP_URL não configurado: e-mail não enviado") };
  }
  const transport = nodemailer.createTransport(smtpUrl);
  return { send: async (email) => void (await transport.sendMail({ from, ...email })) };
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: rules.timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const people = (count: number) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`;

type ReservationMail = { name: string; email: string; startsAt: Date; endsAt: Date; partySize: number };

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Arquivo .ics para o cliente adicionar a reserva ao calendário. */
export function reservationIcs(reservation: ReservationMail, id: string) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pincelada//Reservas//PT",
    "BEGIN:VEVENT",
    `UID:${id}@pincelada`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(reservation.startsAt)}`,
    `DTEND:${icsDate(reservation.endsAt)}`,
    `SUMMARY:Reserva no Pincelada (${people(reservation.partySize)})`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function confirmationEmail(reservation: ReservationMail, id: string, manageUrl: string): Email {
  return {
    to: reservation.email,
    subject: "Reserva confirmada",
    text: [
      `Olá, ${reservation.name}!`,
      "",
      `Sua reserva está confirmada: mesa para ${people(reservation.partySize)}, ${dateTime.format(reservation.startsAt)}.`,
      "",
      `Para ver ou cancelar (até ${rules.cancelMinAdvanceMinutes / 60}h antes), use este link pessoal:`,
      manageUrl,
      "",
      "Guarde o link: quem o tiver pode cancelar a reserva.",
    ].join("\n"),
    attachments: [
      { filename: "reserva.ics", content: reservationIcs(reservation, id), contentType: "text/calendar; charset=utf-8" },
    ],
  };
}

export function cancellationEmail(reservation: ReservationMail): Email {
  return {
    to: reservation.email,
    subject: "Reserva cancelada",
    text: [
      `Olá, ${reservation.name}.`,
      "",
      `Sua reserva de ${dateTime.format(reservation.startsAt)} para ${people(reservation.partySize)} foi cancelada.`,
      "Esperamos receber você em outra ocasião.",
    ].join("\n"),
  };
}

type Logger = { error: (object: object, message: string) => void };

/** E-mail não pode desfazer nem atrasar a ação: uma falha vira log, sem dado pessoal. */
export function sendInBackground(mailer: Mailer, log: Logger, email: Email) {
  mailer.send(email).catch((error: unknown) => {
    log.error({ err: error instanceof Error ? error.message : "erro desconhecido" }, "falha ao enviar e-mail");
  });
}
