import type { Appointment } from "@/lib/supabase/database.types";

export const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  canceled: "Cancelado",
  completed: "Concluído",
  no_show: "Não compareceu",
} satisfies Record<Appointment["status"], string>;
