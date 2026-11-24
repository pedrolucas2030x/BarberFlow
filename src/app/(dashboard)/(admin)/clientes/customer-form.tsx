"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "@/components/dashboard/registry.module.css";
import { deleteCustomer, saveCustomer, type CustomerFormState } from "@/features/customers/actions";

type Customer = {
  id: string;
  name: string;
  phone: string;
  marketing_consent: boolean;
};

const initialState: CustomerFormState = {};

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, formAction, pending] = useActionState(saveCustomer, initialState);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [consent, setConsent] = useState(customer?.marketing_consent ?? false);
  const nameError = state.errors?.name?.[0];
  const phoneError = state.errors?.phone?.[0];
  const consentError = state.errors?.marketingConsent?.[0];

  return (
    <form action={formAction} className={styles.form} aria-busy={pending}>
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {state.message && <p className={styles.error} role="alert">{state.message}</p>}

      <div className={styles.field}>
        <label htmlFor="customer-name">Nome do cliente</label>
        <input
          id="customer-name" name="name" autoComplete="name" required minLength={2} maxLength={100}
          value={name} onChange={(event) => setName(event.currentTarget.value)}
          aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "customer-name-error" : undefined}
        />
        {nameError && <p id="customer-name-error" className={styles.error} role="alert">{nameError}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="customer-phone">Telefone</label>
        <input
          id="customer-phone" name="phone" type="tel" autoComplete="tel" required maxLength={32}
          value={phone} onChange={(event) => setPhone(event.currentTarget.value)}
          aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "customer-phone-error" : "customer-phone-help"}
        />
        {phoneError ? <p id="customer-phone-error" className={styles.error} role="alert">{phoneError}</p> : (
          <p id="customer-phone-help" className={styles.muted}>Informe o DDD. Para números internacionais, inclua + e o código do país.</p>
        )}
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox" name="marketingConsent" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)}
          aria-invalid={Boolean(consentError)} aria-describedby={consentError ? "customer-consent-error" : undefined}
        />
        O cliente autorizou receber mensagens de marketing
      </label>
      {consentError && <p id="customer-consent-error" className={styles.error} role="alert">{consentError}</p>}

      <div className={styles.actions}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : customer ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
        <Link href="/clientes" className={styles.secondary}>Cancelar</Link>
      </div>
    </form>
  );
}

function DeleteCustomerButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.danger} disabled={pending}>
      {pending ? "Excluindo…" : "Excluir cliente"}
    </button>
  );
}

export function DeleteCustomerForm({ id, message }: { id: string; message?: string }) {
  return (
    <form action={deleteCustomer.bind(null, id)} className={styles.form}>
      {message && <p className={styles.error} role="alert">{message}</p>}
      <label className={styles.checkbox}>
        <input type="checkbox" name="confirmation" required />
        Confirmo a exclusão definitiva deste cadastro.
      </label>
      <div className={styles.actions}>
        <DeleteCustomerButton />
      </div>
    </form>
  );
}
