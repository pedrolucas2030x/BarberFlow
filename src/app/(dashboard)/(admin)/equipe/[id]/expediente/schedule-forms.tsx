"use client";

import styles from "@/components/dashboard/registry.module.css";
import { removeTimeOff, removeWeeklyShift, saveTimeOff, saveWeeklyShift } from "@/features/schedule/actions";
import { weekdays } from "@/features/schedule/weekdays";
import { TeamForm, TeamInput, TeamSelect } from "../../team-form";

type Shift = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  break_starts_at: string | null;
  break_ends_at: string | null;
};

export function WeeklyShiftForm({ professionalId, shift, occupiedDays }: {
  professionalId: string;
  shift?: Shift;
  occupiedDays: number[];
}) {
  return (
    <TeamForm action={saveWeeklyShift}>
      {(state, pending) => (
        <>
          <input type="hidden" name="professional_id" value={professionalId} />
          {shift && <input type="hidden" name="id" value={shift.id} />}
          <TeamSelect label="Dia da semana" name="weekday" initialValue={shift?.weekday.toString()} error={state.issues?.weekday?.[0]}>
            <option value="">Selecione um dia</option>
            {weekdays.map((day, index) => (
              <option key={day} value={index} disabled={occupiedDays.includes(index) && index !== shift?.weekday}>{day}</option>
            ))}
          </TeamSelect>
          <div className={styles.fieldGrid}>
            <TeamInput label="Início do turno" name="starts_at" type="time" required
              initialValue={shift?.starts_at.slice(0, 5)} error={state.issues?.starts_at?.[0]} />
            <TeamInput label="Fim do turno" name="ends_at" type="time" required
              initialValue={shift?.ends_at.slice(0, 5)} error={state.issues?.ends_at?.[0]} />
          </div>
          <div className={styles.fieldGrid}>
            <TeamInput label="Início da pausa (opcional)" name="break_starts_at" type="time"
              initialValue={shift?.break_starts_at?.slice(0, 5)} error={state.issues?.break_starts_at?.[0]} />
            <TeamInput label="Fim da pausa (opcional)" name="break_ends_at" type="time"
              initialValue={shift?.break_ends_at?.slice(0, 5)} error={state.issues?.break_ends_at?.[0]} />
          </div>
          <div className={styles.actions}>
            <button type="submit" className="primary-button">
              {pending ? "Salvando…" : shift ? "Salvar turno" : "Cadastrar turno"}
            </button>
          </div>
        </>
      )}
    </TeamForm>
  );
}

export function TimeOffForm({ professionalId, block }: {
  professionalId: string;
  block?: { id: string; start: string; end: string; reason: string | null };
}) {
  return (
    <TeamForm action={saveTimeOff}>
      {(state, pending) => (
        <>
          <input type="hidden" name="professional_id" value={professionalId} />
          {block && <input type="hidden" name="id" value={block.id} />}
          <div className={styles.fieldGrid}>
            <TeamInput label="Início do bloqueio" name="starts_at" type="datetime-local" required
              initialValue={block?.start} error={state.issues?.starts_at?.[0]} />
            <TeamInput label="Fim do bloqueio" name="ends_at" type="datetime-local" required
              initialValue={block?.end} error={state.issues?.ends_at?.[0]} />
          </div>
          <TeamInput label="Motivo (opcional)" name="reason" maxLength={160}
            initialValue={block?.reason ?? ""} error={state.issues?.reason?.[0]} />
          <div className={styles.actions}>
            <button type="submit" className="primary-button">
              {pending ? "Salvando…" : block ? "Salvar bloqueio" : "Cadastrar bloqueio"}
            </button>
          </div>
        </>
      )}
    </TeamForm>
  );
}

export function RemoveScheduleRecord({ professionalId, id, kind }: {
  professionalId: string;
  id: string;
  kind: "turno" | "bloqueio";
}) {
  return (
    <details>
      <summary className={styles.secondary}>Remover {kind}</summary>
      <TeamForm action={kind === "turno" ? removeWeeklyShift : removeTimeOff}>
        {(_state, pending) => (
          <>
            <input type="hidden" name="professional_id" value={professionalId} />
            <input type="hidden" name="id" value={id} />
            <div className={styles.actions}>
              <button type="submit" className={styles.danger}>
                {pending ? "Removendo…" : `Confirmar remoção do ${kind}`}
              </button>
            </div>
          </>
        )}
      </TeamForm>
    </details>
  );
}
