import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { cancelAppointment, completeAppointment, recordAppointmentPayment } from "@/features/appointments/actions";
import { listAppointments } from "@/features/appointments/data";
import { adjacentAppointmentDay, appointmentDay, todayForAppointments } from "@/features/appointments/dates";
import { paymentMethods } from "@/features/finance/payment-methods";
import { requireWorkspace } from "@/features/workspace/access";

export const metadata: Metadata = { title: "Agenda" };

const displayDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels = { confirmed: "Confirmado", canceled: "Cancelado", completed: "Concluído" };
const successMessages = {
  criado: "Agendamento criado.",
  cancelado: "Agendamento cancelado.",
  concluido: "Atendimento concluído.",
  recebido: "Pagamento registrado no Financeiro.",
};
const errorMessages = {
  erro: "Não foi possível cancelar este agendamento. Atualize a agenda e tente novamente.",
  erro_conclusao: "Não foi possível concluir este atendimento. Atualize a agenda e verifique o horário e o status.",
  erro_pagamento: "Não foi possível registrar o pagamento. Atualize a agenda e verifique o atendimento.",
  pagamento_existente: "Já existe um pagamento registrado para este atendimento com outra forma de pagamento.",
};

export default async function SchedulePage({ searchParams }: {
  searchParams: Promise<{ data?: string; resultado?: string }>;
}) {
  const { organization, role } = await requireWorkspace("member");
  const { data, resultado } = await searchParams;
  const canManage = role !== "barber";
  const today = todayForAppointments(organization.timezone);
  const day = appointmentDay(data) ?? today;
  const previous = adjacentAppointmentDay(day, -1);
  const next = adjacentAppointmentDay(day, 1);
  const bookings = await listAppointments(organization.id, day);
  const localTime = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: organization.timezone });
  const cancel = cancelAppointment.bind(null, day);
  const complete = completeAppointment.bind(null, day);
  const recordPayment = recordAppointmentPayment.bind(null, day);
  const success = resultado && Object.hasOwn(successMessages, resultado) ? successMessages[resultado as keyof typeof successMessages] : null;
  const error = resultado && Object.hasOwn(errorMessages, resultado) ? errorMessages[resultado as keyof typeof errorMessages] : null;

  return (
    <>
      <div className={styles.heading}>
        <div className="page-intro">
          <h1>Agenda</h1>
          <p>{canManage ? "Consulte e gerencie os agendamentos da barbearia." : "Consulte seus agendamentos."}</p>
        </div>
        {canManage && (
          <Link href={`/agenda/novo?data=${day < today ? today : day}`} className="primary-button">
            <Plus size={17} aria-hidden="true" /> Novo agendamento
          </Link>
        )}
      </div>

      <section className={styles.panel} aria-labelledby="agenda-day">
        <div className={styles.heading}>
          <h2 id="agenda-day" className={styles.panelHeading}>
            <time dateTime={day}>{displayDay.format(new Date(`${day}T00:00:00Z`))}</time>
          </h2>
          <nav className={styles.actions} aria-label="Navegação por data">
            {previous && <Link href={`/agenda?data=${previous}`} className={styles.secondary} aria-label="Dia anterior"><ArrowLeft size={17} aria-hidden="true" /></Link>}
            <Link href="/agenda" className={styles.secondary}>Hoje</Link>
            {next && <Link href={`/agenda?data=${next}`} className={styles.secondary} aria-label="Próximo dia"><ArrowRight size={17} aria-hidden="true" /></Link>}
          </nav>
        </div>
        <form method="get" action="/agenda" className={`${styles.search} mt-4`}>
          <div className={styles.field}>
            <label htmlFor="agenda-date">Escolher data</label>
            <input key={day} id="agenda-date" name="data" type="date" defaultValue={day} max="9999-12-31" required />
          </div>
          <button type="submit" className={styles.secondary}>Ver dia</button>
        </form>

        {success && <p role="status" className={`${styles.success} mt-4`}>{success}</p>}
        {error && <p role="alert" className={`${styles.error} mt-4`}>{error}</p>}
        {!bookings && <p role="alert" className={`${styles.error} mt-4`}>Não foi possível consultar os agendamentos. Tente novamente.</p>}
        {bookings?.length === 0 && <p className={`${styles.muted} mt-4`}>Nenhum agendamento para este dia.</p>}
        {bookings && bookings.length > 0 && (
          <ul className={styles.list}>
            {bookings.map((booking) => {
              const amount = booking.price_cents === null ? null : currency.format(booking.price_cents / 100);
              const paymentLabel = booking.price_cents === 0 ? "Cortesia" : booking.is_paid ? "Pago" : "Pagamento pendente";
              return (
                <li className={styles.item} key={booking.id}>
                  <div className={styles.itemHeader}>
                    <div>
                      <h3>{booking.service_name} · {booking.customer_name ?? "Cliente removido"}</h3>
                      <p className={styles.details}>
                        <time dateTime={booking.starts_at}>{localTime.format(new Date(booking.starts_at))}</time>
                        {" – "}
                        <time dateTime={booking.ends_at}>{localTime.format(new Date(booking.ends_at))}</time>
                        {" · "}{booking.professional_name}
                        {amount && ` · ${amount}`}
                      </p>
                    </div>
                    <div className={styles.actions}>
                      <span className={styles.badge}>{statusLabels[booking.status]}</span>
                      {canManage && booking.status === "completed" && booking.is_paid !== null && (
                        <span className={styles.badge}>{paymentLabel}</span>
                      )}
                    </div>
                  </div>
                  {canManage && booking.can_complete && (
                    <form action={complete}>
                      <input type="hidden" name="completion" value={booking.id} />
                      <button type="submit" className={styles.secondary}>Concluir atendimento</button>
                    </form>
                  )}
                  {canManage && booking.status === "confirmed" && (
                    <details>
                      <summary className={styles.secondary}>Cancelar agendamento</summary>
                      <form action={cancel} className="mt-2">
                        <input type="hidden" name="appointment" value={booking.id} />
                        <label className={styles.checkbox}>
                          <input type="checkbox" name="confirm" required /> Confirmo o cancelamento deste horário.
                        </label>
                        <button type="submit" className={styles.danger}>Confirmar cancelamento</button>
                      </form>
                    </details>
                  )}
                  {canManage && booking.status === "completed" && booking.is_paid === false && (booking.price_cents ?? 0) > 0 && (
                    <details>
                      <summary className={styles.secondary}>Registrar pagamento</summary>
                      <form action={recordPayment} className={styles.form}>
                        <input type="hidden" name="payment" value={booking.id} />
                        <div className={styles.field}>
                          <label htmlFor={`payment-method-${booking.id}`}>Forma de pagamento</label>
                          <select id={`payment-method-${booking.id}`} name="method" defaultValue="" required>
                            <option value="" disabled>Selecione a forma de pagamento</option>
                            {Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                        <div className={styles.actions}>
                          <button type="submit" className="primary-button">Confirmar recebimento de {amount}</button>
                        </div>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
