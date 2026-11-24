"use client";

import { useActionState, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "@/components/dashboard/registry.module.css";
import { initialTeamFormState, type TeamFormAction, type TeamFormState } from "@/features/professionals/form-state";

export function TeamForm({ action, children, compact = false }: {
  action: TeamFormAction;
  children: (state: TeamFormState, pending: boolean) => ReactNode;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialTeamFormState);
  return (
    <form action={formAction} aria-busy={pending}>
      <fieldset key={state.revision} disabled={pending} className={`${compact ? styles.actions : styles.form} min-w-0`}>
        {children(state, pending)}
      </fieldset>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.error : styles.success}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function TeamInput({ label, name, initialValue = "", error, ...attributes }: {
  label: string;
  name: string;
  initialValue?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "defaultValue" | "onChange">) {
  const id = useId();
  const [value, setValue] = useState(initialValue);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        {...attributes}
        id={id}
        name={name}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  );
}

export function TeamSelect({ label, name, initialValue = "", error, children }: {
  label: string;
  name: string;
  initialValue?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [value, setValue] = useState(initialValue);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} required value={value} onChange={(event) => setValue(event.currentTarget.value)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
        {children}
      </select>
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  );
}
