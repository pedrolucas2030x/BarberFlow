import { CalendarDays } from "lucide-react";
import { defaultTimeZone, isSupportedTimeZone } from "@/lib/app-time-zone";

export function CurrentDate({ timezone }: { timezone: string }) {
  const timeZone = isSupportedTimeZone(timezone) ? timezone : defaultTimeZone;
  const now = new Date();
  const displayDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
  const machineDate = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });

  return (
    <div className="date-chip">
      <CalendarDays size={16} aria-hidden="true" />
      <time dateTime={machineDate.format(now)}>{displayDate.format(now)}</time>
    </div>
  );
}
