export const SHOP_TIME_ZONE = "America/Sao_Paulo";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):(00|30)$/;

export type ScheduleWindow = {
  startsAt: Date;
  endsAt: Date;
};

export function buildScheduleWindow(date: string, time: string, durationMinutes: number): ScheduleWindow {
  if (!DATE_RE.test(date) || !TIME_RE.test(time) || durationMinutes <= 0) {
    throw new Error("INVALID_SCHEDULE");
  }

  const startsAt = new Date(`${date}T${time}:00-03:00`);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  if (Number.isNaN(startsAt.getTime())) throw new Error("INVALID_SCHEDULE");

  const [year, month, day] = date.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) throw new Error("INVALID_SCHEDULE");

  if (calendarDate.getUTCDay() === 0) throw new Error("SHOP_CLOSED");

  const opensAt = new Date(`${date}T09:00:00-03:00`);
  const closesAt = new Date(`${date}T20:00:00-03:00`);
  if (startsAt < opensAt || endsAt > closesAt) throw new Error("OUTSIDE_HOURS");

  const now = Date.now();
  if (startsAt.getTime() <= now) throw new Error("PAST_SCHEDULE");
  if (startsAt.getTime() > now + 90 * 24 * 60 * 60 * 1_000) throw new Error("TOO_FAR");

  return { startsAt, endsAt };
}

export function scheduleError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SHOP_CLOSED") return "A barbearia não abre aos domingos.";
  if (code === "OUTSIDE_HOURS") return "Escolha um horário entre 09:00 e 20:00.";
  if (code === "PAST_SCHEDULE") return "Escolha uma data e horário futuros.";
  if (code === "TOO_FAR") return "O agendamento pode ser feito com até 90 dias de antecedência.";
  return "Escolha uma data válida e um horário de 30 em 30 minutos.";
}
