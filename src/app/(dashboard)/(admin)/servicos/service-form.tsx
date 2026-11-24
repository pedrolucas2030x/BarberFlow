"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import styles from "@/components/dashboard/registry.module.css";
import { saveService, type ServiceFormState } from "@/features/services/actions";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

const initialState: ServiceFormState = {};
const priceInput = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ServiceForm({ service }: { service?: Service }) {
  const [state, formAction, pending] = useActionState(saveService, initialState);
  const [name, setName] = useState(service?.name ?? "");
  const [duration, setDuration] = useState(service ? String(service.duration_minutes) : "");
  const [price, setPrice] = useState(service ? priceInput.format(service.price_cents / 100) : "");
  const [active, setActive] = useState(service?.active ?? true);
  const nameError = state.errors?.name?.[0];
  const durationError = state.errors?.durationMinutes?.[0];
  const priceError = state.errors?.price?.[0];
  const activeError = state.errors?.active?.[0];

  return (
    <form action={formAction} className={styles.form} aria-busy={pending}>
      {service && <input type="hidden" name="id" value={service.id} />}
      {state.message && <p className={styles.error} role="alert">{state.message}</p>}
      <div className={styles.field}>
        <label htmlFor="service-name">Nome do serviço</label>
        <input
          id="service-name" name="name" value={name} onChange={(event) => setName(event.currentTarget.value)}
          required minLength={2} maxLength={100}
          aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "service-name-error" : undefined}
        />
        {nameError && <p id="service-name-error" className={styles.error} role="alert">{nameError}</p>}
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="service-duration">Duração (minutos)</label>
          <input
            id="service-duration" name="durationMinutes" type="number" inputMode="numeric" min={1} max={1440} step={1}
            value={duration} onChange={(event) => setDuration(event.currentTarget.value)} required
            aria-invalid={Boolean(durationError)} aria-describedby={durationError ? "service-duration-error" : undefined}
          />
          {durationError && <p id="service-duration-error" className={styles.error} role="alert">{durationError}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor="service-price">Preço (R$)</label>
          <input
            id="service-price" name="price" inputMode="decimal" placeholder="0,00" maxLength={24}
            value={price} onChange={(event) => setPrice(event.currentTarget.value)} required
            aria-invalid={Boolean(priceError)} aria-describedby={priceError ? "service-price-error" : undefined}
          />
          {priceError && <p id="service-price-error" className={styles.error} role="alert">{priceError}</p>}
        </div>
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox" name="active" checked={active} onChange={(event) => setActive(event.currentTarget.checked)}
          aria-invalid={Boolean(activeError)} aria-describedby={activeError ? "service-active-error" : undefined}
        />
        Serviço ativo no catálogo
      </label>
      {activeError && <p id="service-active-error" className={styles.error} role="alert">{activeError}</p>}

      <div className={styles.actions}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : service ? "Salvar alterações" : "Cadastrar serviço"}
        </button>
        <Link href="/servicos" className={styles.secondary}>Cancelar</Link>
      </div>
    </form>
  );
}
