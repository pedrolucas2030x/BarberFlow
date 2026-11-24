export const defaultTimeZone = "America/Fortaleza";

export function isSupportedTimeZone(timeZone: string) {
  if (!timeZone || /^[+-]/.test(timeZone)) return false;

  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

const configuredTimeZone = process.env.BARBERFLOW_TIMEZONE?.trim();
export const appTimeZone = configuredTimeZone && isSupportedTimeZone(configuredTimeZone)
  ? configuredTimeZone
  : defaultTimeZone;
