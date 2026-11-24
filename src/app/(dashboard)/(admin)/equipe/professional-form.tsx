"use client";

import styles from "@/components/dashboard/registry.module.css";
import { saveProfessional, setProfessionalStatus } from "@/features/professionals/actions";
import { TeamForm, TeamInput } from "./team-form";

export function ProfessionalForm({ professional }: {
  professional?: { id: string; name: string; commission_bps: number; specialties: string | null };
}) {
  return (
    <TeamForm action={saveProfessional}>
      {(state, pending) => (
        <>
          {professional && <input type="hidden" name="id" value={professional.id} />}
          <div className={styles.fieldGrid}>
            <TeamInput label="Nome" name="name" initialValue={professional?.name} autoComplete="name"
              minLength={2} maxLength={100} required error={state.issues?.name?.[0]} />
            <TeamInput label="Especialidades (opcional)" name="specialties" initialValue={professional?.specialties ?? ""}
              maxLength={160} error={state.issues?.specialties?.[0]} />
            <TeamInput label="Comissão (%)" name="commission" inputMode="decimal" maxLength={6}
              initialValue={professional ? (professional.commission_bps / 100).toFixed(2).replace(".", ",") : "0"}
              required error={state.issues?.commission?.[0]} />
          </div>
          <div className={styles.actions}>
            <button type="submit" className="primary-button">
              {pending ? "Salvando…" : professional ? "Salvar alterações" : "Cadastrar profissional"}
            </button>
          </div>
        </>
      )}
    </TeamForm>
  );
}

export function ProfessionalStatusForm({ id, active }: { id: string; active: boolean }) {
  return (
    <TeamForm action={setProfessionalStatus} compact>
      {(_state, pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={String(!active)} />
          <button type="submit" className={styles.secondary}>
            {pending ? "Atualizando…" : active ? "Desativar" : "Reativar"}
          </button>
        </>
      )}
    </TeamForm>
  );
}
