import { z } from "zod";
import { formatTenantDateTime } from "@/lib/validation/schedule";

export function appointmentDay(value: unknown) {
  const parsed = z.iso.date().safeParse(value);
  return parsed.success && !parsed.data.startsWith("0000") ? parsed.data : null;
}

export function todayForAppointments(timezone: string) {
  return formatTenantDateTime(new Date().toISOString(), timezone).slice(0, 10);
}

export function adjacentAppointmentDay(day: string, offset: -1 | 1) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return appointmentDay(date.toISOString().split("T")[0]);
}
