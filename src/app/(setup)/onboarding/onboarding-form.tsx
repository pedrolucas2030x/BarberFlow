"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";
import { createOrganization, type OnboardingState } from "@/features/workspace/actions";
import styles from "../setup.module.css";

const brazilianTimezones = [
  ["America/Fortaleza", "Fortaleza"],
  ["America/Sao_Paulo", "São Paulo"],
  ["America/Bahia", "Bahia"],
  ["America/Belem", "Belém"],
  ["America/Recife", "Recife"],
  ["America/Araguaina", "Araguaína"],
  ["America/Maceio", "Maceió"],
  ["America/Manaus", "Manaus"],
  ["America/Cuiaba", "Cuiabá"],
  ["America/Campo_Grande", "Campo Grande"],
  ["America/Porto_Velho", "Porto Velho"],
  ["America/Boa_Vista", "Boa Vista"],
  ["America/Santarem", "Santarém"],
  ["America/Rio_Branco", "Rio Branco"],
  ["America/Eirunepe", "Eirunepé"],
  ["America/Noronha", "Fernando de Noronha"],
];

const initialState: OnboardingState = {};

function createSlug(name: string) {
  return name.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}

export function OnboardingForm({ initialTimezone }: { initialTimezone: string }) {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(initialTimezone);
  const timezones = brazilianTimezones.some(([value]) => value === initialTimezone)
    ? brazilianTimezones
    : [[initialTimezone, initialTimezone], ...brazilianTimezones];
  const { name: nameErrors, slug: slugErrors, timezone: timezoneErrors } = state.errors ?? {};

  return (
    <form action={formAction} className={styles.form} aria-busy={pending}>
      {(state.message || state.errors) && (
        <p className={styles.error} role="alert">{state.message ?? "Revise os campos destacados."}</p>
      )}
      <div className={styles.field}>
        <label htmlFor="name">Nome da barbearia</label>
        <input
          id="name" name="name" autoComplete="organization" required minLength={2} maxLength={100}
          value={name} onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(nameErrors)} aria-describedby={nameErrors ? "name-error" : undefined}
        />
        {nameErrors && <p id="name-error" className={styles.error}>{nameErrors[0]}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="slug">Identificador da barbearia</label>
        <input
          id="slug" name="slug" required minLength={3} maxLength={63} autoComplete="off"
          autoCapitalize="none" spellCheck={false} value={customSlug ?? createSlug(name)}
          onChange={(event) => setCustomSlug(event.target.value)}
          aria-invalid={Boolean(slugErrors)} aria-describedby={slugErrors ? "slug-help slug-error" : "slug-help"}
        />
        <p id="slug-help">Use letras minúsculas, números e hífens entre palavras.</p>
        {slugErrors && <p id="slug-error" className={styles.error}>{slugErrors[0]}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="timezone">Fuso horário</label>
        <select
          id="timezone" name="timezone" required value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          aria-invalid={Boolean(timezoneErrors)} aria-describedby={timezoneErrors ? "timezone-error" : undefined}
        >
          {timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {timezoneErrors && <p id="timezone-error" className={styles.error}>{timezoneErrors[0]}</p>}
      </div>
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar barbearia"} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
