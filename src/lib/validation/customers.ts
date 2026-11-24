import { z } from "zod";

const brazilianNationalNumber = /^[1-9]\d{9,10}$/;
const brazilianInternationalNumber = /^\+55[1-9]\d{9,10}$/;
const internationalNumber = /^\+[1-9]\d{7,14}$/;

function toInternationalPhone(value: string) {
  if (!/^\+?[\d ().-]+$/.test(value)) return null;

  const compact = value.replace(/[ ().-]/g, "");
  if (compact.startsWith("+55")) return brazilianInternationalNumber.test(compact) ? compact : null;
  if (compact.startsWith("+")) return internationalNumber.test(compact) ? compact : null;
  if (brazilianNationalNumber.test(compact)) return `+55${compact}`;
  if (brazilianInternationalNumber.test(`+${compact}`)) return `+${compact}`;

  return null;
}

export const customerFieldsSchema = z.object({
  name: z.string({ error: "Informe o nome do cliente." }).trim()
    .refine((name) => [...name].length >= 2 && [...name].length <= 100, "Use de 2 a 100 caracteres.")
    .refine((name) => !/\p{Cc}/u.test(name), "Use um nome sem quebras de linha."),
  phone: z.string({ error: "Informe o telefone do cliente." }).trim().max(32)
    .transform((value, context) => {
      const phone = toInternationalPhone(value);
      if (phone) return phone;

      context.addIssue({ code: "custom", message: "Informe um telefone com DDD ou um número internacional com + e código do país." });
      return z.NEVER;
    }),
  marketingConsent: z.literal("on").nullable().transform((value) => value === "on"),
});
