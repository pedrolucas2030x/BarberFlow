import { z } from "zod";
import { isSupportedTimeZone } from "@/lib/app-time-zone";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(100, "Use até 100 caracteres."),
  slug: z.string().trim()
    .min(3, "Use pelo menos 3 caracteres.")
    .max(63, "Use até 63 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens entre palavras."),
  timezone: z.string().trim().max(64).refine(isSupportedTimeZone, "Selecione um fuso horário válido."),
});
