const timeZone = "America/Sao_Paulo";

const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
const dateLong = new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone });

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDate = (iso: string) => dateLong.format(new Date(iso));
export const todayInSaoPaulo = () => isoDate.format(new Date());
export const addDays = (date: string, days: number) => {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
export const isLunch = (iso: string) => Number(hour.format(new Date(iso))) < 17;
