"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import styles from "@/components/dashboard/registry.module.css";
import { createAppointment, searchAppointmentCustomers } from "@/features/appointments/actions";
import type { AppointmentCustomers } from "@/features/appointments/data";

export function AppointmentForm({ professionals, customers, day, today }: {
  professionals: { id: string; name: string; services: { id: string; name: string; duration_minutes: number }[] }[];
  customers: AppointmentCustomers;
  day: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(createAppointment, {});
  const [results, search, searching] = useActionState(searchAppointmentCustomers, customers);
  const [query, setQuery] = useState("");
  const solo = professionals.length === 1 ? professionals[0] : undefined;
  const [professional, setProfessional] = useState(solo?.id ?? "");
  const [existing, setExisting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState("");
  const [service, setService] = useState(solo?.services.length === 1 ? solo.services[0].id : "");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("");
  const services = professionals.find(({ id }) => id === professional)?.services ?? [];
  const selectedCustomer = results.rows.some(({ id }) => id === customer) ? customer : "";

  return (
    <>
      {existing && (customers.hasNext || results.page > 1 || results.query) && (
        <form action={search} className={`${styles.search} mt-4`} aria-busy={searching}>
          <div className={styles.field}>
            <label htmlFor="appointment-search">Buscar cliente por nome ou telefone</label>
            <input id="appointment-search" name="query" type="search" maxLength={80} value={query}
              onChange={(event) => setQuery(event.currentTarget.value)} />
          </div>
          <button type="submit" className={styles.secondary} disabled={searching}>Buscar</button>
          {results.page > 1 && query.trim() === results.query && (
            <button type="submit" name="page" value={results.page - 1} className={styles.secondary} disabled={searching}>Clientes anteriores</button>
          )}
          {results.hasNext && query.trim() === results.query && (
            <button type="submit" name="page" value={results.page + 1} className={styles.secondary} disabled={searching}>Próximos clientes</button>
          )}
        </form>
      )}
      {results.failed && <p role="alert" className={`${styles.error} mt-4`}>Não foi possível buscar clientes. Tente novamente.</p>}
      {existing && !results.failed && !results.rows.length && <p role="status" className={`${styles.muted} mt-4`}>Nenhum cliente encontrado.</p>}
      <form action={action} className={styles.form} aria-busy={pending}>
        {state.message && <p role="alert" className={styles.error}>{state.message}</p>}
        <fieldset disabled={pending} className={styles.fieldGrid}>
          {solo ? <input type="hidden" name="professional" value={solo.id} /> : <div className={styles.field}>
            <label htmlFor="appointment-professional">Profissional</label>
            <select id="appointment-professional" name="professional" required value={professional} onChange={(event) => {
              setProfessional(event.currentTarget.value);
              setService("");
            }}>
              <option value="">Selecione o profissional</option>
              {professionals.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>}
          <div className={styles.field}>
            <label htmlFor="appointment-service">Serviço</label>
            <select id="appointment-service" name="service" required value={service} onChange={(event) => setService(event.currentTarget.value)}>
              <option value="">{professional ? "Selecione o serviço" : "Selecione o profissional primeiro"}</option>
              {services.map(({ id, name, duration_minutes }) => <option key={id} value={id}>{name} · {duration_minutes} min</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="appointment-date">Data</label>
            <input id="appointment-date" name="date" type="date" required min={today} max="9999-12-31"
              value={date} onChange={(event) => setDate(event.currentTarget.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="appointment-time">Horário</label>
            <input id="appointment-time" name="time" type="time" required value={time}
              onChange={(event) => setTime(event.currentTarget.value)} />
          </div>
          {existing ? <div className={styles.field}>
            <label htmlFor="appointment-customer">Cliente</label>
            <select id="appointment-customer" name="customer" required value={selectedCustomer} onChange={(event) => setCustomer(event.currentTarget.value)}>
              <option value="">Selecione o cliente</option>
              {results.rows.map(({ id, name, contact }) => <option key={id} value={id}>{name} · {contact}</option>)}
            </select>
          </div> : <>
            <input type="hidden" name="customer" value="" />
            <div className={styles.field}>
              <label htmlFor="appointment-name">Nome do cliente</label>
              <input id="appointment-name" name="customerName" required minLength={2} maxLength={100}
                value={name} onChange={(event) => setName(event.currentTarget.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="appointment-phone">Telefone (opcional)</label>
              <input id="appointment-phone" name="customerPhone" type="tel" maxLength={32}
                value={phone} onChange={(event) => setPhone(event.currentTarget.value)} />
            </div>
          </>}
        </fieldset>
        <div className={styles.actions}>
          <button type="submit" className="primary-button" disabled={pending || searching || (existing && !selectedCustomer)}>{pending ? "Agendando…" : "Confirmar agendamento"}</button>
          {customers.rows.length > 0 && (
            <button type="button" className={styles.secondary} disabled={pending} onClick={() => setExisting(!existing)}>
              {existing ? "Digitar nome" : "Usar cliente cadastrado"}
            </button>
          )}
          <Link href={`/agenda?data=${day}`} className={styles.secondary}>Voltar à agenda</Link>
        </div>
      </form>
    </>
  );
}
