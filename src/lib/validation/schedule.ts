import { z } from "zod";

const timeOfDay = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");
const optionalTime = z.union([timeOfDay, z.literal("")]).transform((value) => value || null);

export const weeklyShiftSchema = z.object({
  id: z.uuid().nullable(),
  weekday: z.string().regex(/^[0-6]$/, "Selecione um dia da semana.").transform(Number),
  starts_at: timeOfDay,
  ends_at: timeOfDay,
  break_starts_at: optionalTime,
  break_ends_at: optionalTime,
}).superRefine((shift, context) => {
  if (shift.ends_at <= shift.starts_at) {
    context.addIssue({ code: "custom", path: ["ends_at"], message: "O fim do turno deve ser depois do início, no mesmo dia." });
  }

  const { break_starts_at: start, break_ends_at: end } = shift;
  if (start === null && end === null) return;

  if (!start || !end) {
    context.addIssue({ code: "custom", path: [start ? "break_ends_at" : "break_starts_at"], message: "Informe o início e o fim da pausa." });
    return;
  }

  if (start <= shift.starts_at || end >= shift.ends_at || end <= start) {
    context.addIssue({ code: "custom", path: ["break_ends_at"], message: "A pausa deve ter início e fim dentro do turno." });
  }
});

const wallTimePattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
const wallTime = z.string().regex(wallTimePattern, "Informe uma data e um horário válidos.");

export const timeOffSchema = z.object({
  id: z.uuid().nullable(),
  starts_at: wallTime,
  ends_at: wallTime,
  reason: z.string().trim().max(160, "Informe até 160 caracteres.")
    .refine((value) => !/\p{Cc}/u.test(value), "Revise o motivo do bloqueio.")
    .transform((value) => value || null),
});

function wallTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatWallTime(value: number, formatter: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(({ type, value }) => [type, value]));
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatTenantDateTime(instant: string, timeZone: string) {
  return formatWallTime(Date.parse(instant), wallTimeFormatter(timeZone)).slice(0, 16);
}

type TimeConversion = { instant: string } | { error: "invalid" | "missing" | "ambiguous" };

export function tenantDateTimeToInstant(value: string, timeZone: string): TimeConversion {
  if (!wallTimePattern.test(value) || value.startsWith("0000")) return { error: "invalid" };

  const wall = `${value}:00`;
  const assumedUtc = Date.parse(`${wall}Z`);
  if (!Number.isFinite(assumedUtc) || new Date(assumedUtc).toISOString().slice(0, 16) !== value) return { error: "invalid" };

  const formatter = wallTimeFormatter(timeZone);
  const dayMs = 86_400_000;
  // Check the UTC offsets on both sides of the submitted wall time and retain exact matches.
  const samples = [assumedUtc - dayMs, assumedUtc, assumedUtc + dayMs];
  const offsets = new Set(samples.map((sample) => Date.parse(`${formatWallTime(sample, formatter)}Z`) - sample));
  const candidates = [...offsets].map((offset) => assumedUtc - offset)
    .filter((instant) => Number.isFinite(instant) && formatWallTime(instant, formatter) === wall);

  if (candidates.length === 0) return { error: "missing" };
  if (candidates.length > 1) return { error: "ambiguous" };
  return { instant: new Date(candidates[0]).toISOString() };
}
