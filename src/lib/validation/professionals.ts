import { z } from "zod";

const recordId = z.uuid();

export const professionalSchema = z.object({
  id: recordId.nullable(),
  name: z.string().trim()
    .min(2, "Informe pelo menos 2 caracteres.")
    .max(100, "Informe até 100 caracteres.")
    .refine((name) => !/\p{Cc}/u.test(name), "Revise o nome do profissional."),
  commission: z.string().trim()
    .regex(/^\d{1,3}(?:[,.]\d{1,2})?$/, "Informe um percentual com até duas casas decimais.")
    .transform((value) => {
      const [integer, decimal = ""] = value.split(/[,.]/);
      return Number(integer) * 100 + Number(decimal.padEnd(2, "0"));
    })
    .pipe(z.number().int().min(0).max(10_000, "A comissão deve estar entre 0% e 100%.")),
});

export const professionalStatusSchema = z.object({ id: recordId, active: z.enum(["true", "false"]) });
