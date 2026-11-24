import { z } from "zod";

const priceLimitInCents = 2_147_483_647;
const brazilianPrice = /^(\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const decimalPointPrice = /^(\d+)\.(\d{1,2})$/;

function toPriceCents(value: string) {
  const parts = value.match(brazilianPrice) ?? value.match(decimalPointPrice);
  if (!parts) return null;

  const whole = parts[1].replace(/\./g, "");
  const fraction = (parts[2] ?? "").padEnd(2, "0");
  const cents = Number(whole + fraction);

  return cents <= priceLimitInCents ? cents : null;
}

export const serviceFieldsSchema = z.object({
  name: z.string({ error: "Informe o nome do serviço." }).trim()
    .refine((name) => [...name].length >= 2 && [...name].length <= 100, "Use de 2 a 100 caracteres.")
    .refine((name) => !/\p{Cc}/u.test(name), "Use um nome sem quebras de linha."),
  durationMinutes: z.string({ error: "Informe a duração em minutos." }).trim()
    .regex(/^\d{1,4}$/, "Informe um número inteiro de minutos.")
    .transform(Number)
    .pipe(z.int().min(1, "Informe pelo menos 1 minuto.").max(1440, "Informe até 1.440 minutos.")),
  price: z.string({ error: "Informe o preço em reais." }).trim().max(24)
    .transform((value, context) => {
      const cents = toPriceCents(value);
      if (cents !== null) return cents;

      context.addIssue({ code: "custom", message: "Informe um preço de 0 a 21.474.836,47 com até duas casas decimais." });
      return z.NEVER;
    }),
  active: z.literal("on").nullable().transform((value) => value === "on"),
});
