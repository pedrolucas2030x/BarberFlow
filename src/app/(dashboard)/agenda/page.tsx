import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { cancelAppointment, changeAppointment, completeAppointment, recordAppointmentPayment } from "@/features/appointments/actions";
import { listAppointmentPeriod } from "@/features/appointments/data";
import { adjacentAppointmentDay, appointmentDay, todayForAppointments } from "@/features/appointments/dates";
import { paymentMethods } from "@/features/finance/payment-methods";
import { requireWorkspace } from "@/features/workspace/access";
import { statusLabels } from "@/features/appointments/status";
import { formatTenantDateTime } from "@/lib/validation/schedule";

export const metadata: Metadata = { title: "Agenda" };

const displayDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const successMessages = {
  criado: "Agendamento criado.",
  cancelado: "Agendamento cancelado.",
  concluido: "Atendimento concluído.",
  recebido: "Pagamento registrado no Financeiro.",
  alterado: "Agendamento atualizado.",
};
const errorMessages = {
  erro: "Não foi possível cancelar este agendamento. Atualize a agenda e tente novamente.",
  erro_conclusao: "Não foi possível concluir este atendimento. Atualize a agenda e verifique o horário e o status.",
  erro_pagamento: "Não foi possível registrar o pagamento. Atualize a agenda e verifique o atendimento.",
  pagamento_existente: "Já existe um pagamento registrado para este atendimento com outra forma de pagamento.",
  erro_alteracao: "Não foi possível alterar este agendamento. Confira o status e a disponibilidade e tente novamente.",
};

export default async function SchedulePage({ searchParams }: {
  searchParams: Promise<{ data?: string; resultado?: string; visao?: string; barbeiro?: string }>;
}) {
  const { organization, role } = await requireWorkspace("member");
  const { data, resultado, visao, barbeiro } = await searchParams;
  const canManage = role !== "barber";
  const today = todayForAppointments(organization.timezone);
  const day = appointmentDay(data) ?? today;
  const view = visao === "semana" || visao === "mes" ? visao : "dia";
  const pivot = new Date(`${day}T00:00:00Z`);
  const offset = (pivot.getUTCDay() + 6) % 7;
  const first = view === "mes" ? `${day.slice(0, 7)}-01` : view === "semana" ? civilDay(pivot, -offset) : day;
  const last = view === "mes"
    ? civilDay(new Date(Date.UTC(pivot.getUTCFullYear(), pivot.getUTCMonth() + 1, 1)), -1)
    : view === "semana" ? civilDay(pivot, 6 - offset) : day;
  const previous = view === "dia" ? adjacentAppointmentDay(day, -1) : civilDay(new Date(`${first}T00:00:00Z`), -1);
  const next = view === "dia" ? adjacentAppointmentDay(day, 1) : civilDay(new Date(`${last}T00:00:00Z`), 1);
  const allBookings = await listAppointmentPeriod(organization.id, first, last);
  const filter = canManage && typeof barbeiro === "string" ? barbeiro : "";
  const professionals = new Map(allBookings?.map((item) => [item.professional_id, item.professional_name]));
  if (filter && !professionals.has(filter)) professionals.set(filter, "Profissional selecionado");
  const bookings = filter ? allBookings?.filter((item) => item.professional_id === filter) : allBookings;
  const retainedFilter = filter ? `&barbeiro=${encodeURIComponent(filter)}` : "";
  const localTime = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: organization.timezone });
  const cancel = cancelAppointment.bind(null, day);
  const complete = completeAppointment.bind(null, day);
  const recordPayment = recordAppointmentPayment.bind(null, day);
  const change = changeAppointment.bind(null, day);
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
        <nav aria-label="Visualização" className={styles.actions}>
          {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([key, label]) =>
            <Link key={key} aria-current={view === key ? "page" : undefined}
              href={`/agenda?data=${day}&visao=${key}${retainedFilter}`} className={styles.secondary}>{label}</Link>)}
        </nav>
        <div className={styles.heading}>
          <h2 id="agenda-day" className={styles.panelHeading}>
            <time dateTime={first}>{displayDay.format(new Date(`${first}T00:00:00Z`))}</time>
            {view !== "dia" && <> até <time dateTime={last}>{displayDay.format(new Date(`${last}T00:00:00Z`))}</time></>}
          </h2>
          <nav className={styles.actions} aria-label="Navegação por data">
            {previous && <Link href={`/agenda?data=${previous}&visao=${view}${retainedFilter}`} className={styles.secondary} aria-label="Período anterior"><ArrowLeft size={17} aria-hidden="true" /></Link>}
            <Link href={`/agenda?visao=${view}${retainedFilter}`} className={styles.secondary}>Hoje</Link>
            {next && <Link href={`/agenda?data=${next}&visao=${view}${retainedFilter}`} className={styles.secondary} aria-label="Próximo período"><ArrowRight size={17} aria-hidden="true" /></Link>}
          </nav>
        </div>
        <form method="get" action="/agenda" className={`${styles.search} mt-4`}>
          <input type="hidden" name="visao" value={view} />
          <div className={styles.field}>
            <label htmlFor="agenda-date">Escolher data</label>
            <input key={day} id="agenda-date" name="data" type="date" defaultValue={day} max="9999-12-31" required />
          </div>
          {canManage && (filter || professionals.size > 1) && <label className={styles.field}>Profissional
            <select name="barbeiro" key={filter} defaultValue={filter}>
              <option value="">Todos</option>
              {[...professionals].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>}
          <button type="submit" className={styles.secondary}>Ver dia</button>
        </form>

        {success && <p role="status" className={`${styles.success} mt-4`}>{success}</p>}
        {error && <p role="alert" className={`${styles.error} mt-4`}>{error}</p>}
        {!bookings && <p role="alert" className={`${styles.error} mt-4`}>Não foi possível consultar os agendamentos. Tente novamente.</p>}
        {bookings?.length === 0 && <p className={`${styles.muted} mt-4`}>Nenhum agendamento para {view === "dia" ? "este dia" : "este período"}.</p>}
        {bookings && bookings.length > 0 && (
          <ul className={styles.list}>
            {bookings.map((booking) => {
              const localStart = formatTenantDateTime(booking.starts_at, organization.timezone);
              const bookingDay = localStart.slice(0, 10);
              const amount = booking.price_cents === null ? null : currency.format(booking.price_cents / 100);
              const paymentLabel = booking.price_cents === 0 ? "Cortesia" : booking.is_paid ? "Pago" : "Pagamento pendente";
              return (
                <li className={styles.item} key={booking.id}>
                  <div className={styles.itemHeader}>
                    <div>
                      <h3>{booking.service_name} · {booking.customer_name ?? "Cliente removido"}</h3>
                      <p className={styles.details}>
                        {view !== "dia" && `${bookingDay.split("-").reverse().join("/")} · `}
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
                  {view !== "dia" && <Link className={styles.secondary} href={`/agenda?data=${bookingDay}`}>Abrir dia</Link>}
                  {view === "dia" && canManage && (booking.status === "confirmed" || booking.status === "pending") && (
                    <details>
                      <summary className={styles.secondary}>Reagendar</summary>
                      <form action={change} className={styles.form}>
                        <input type="hidden" name="change" value={booking.id} />
                        <input type="hidden" name="expected" value={booking.starts_at} />
                        <input type="hidden" name="operation" value="reschedule" />
                        <label className={styles.field}>Nova data<input type="date" name="date" defaultValue={bookingDay} min={today} required /></label>
                        <label className={styles.field}>Novo horário<input type="time" name="time" defaultValue={localStart.slice(11)} required /></label>
                        <button className={styles.secondary} type="submit">Salvar horário</button>
                      </form>
                    </details>
                  )}
                  {view === "dia" && canManage && (booking.can_complete || booking.status === "pending" || booking.status === "in_progress") && (
                    <form action={change} className={styles.actions}>
                      <input type="hidden" name="change" value={booking.id} />
                      <input type="hidden" name="expected" value={booking.starts_at} />
                      {booking.can_complete && <>
                        <button className={styles.secondary} name="operation" value="start">Iniciar atendimento</button>
                        <button className={styles.secondary} name="operation" value="no_show">Não compareceu</button>
                      </>}
                      {booking.status === "pending" && <button className={styles.secondary} name="operation" value="confirm">Confirmar</button>}
                      {booking.status === "in_progress" && <button className={styles.secondary} name="operation" value="complete">Concluir atendimento</button>}
                    </form>
                  )}
                  {view === "dia" && canManage && (booking.status === "pending" || booking.status === "in_progress") && (
                    <details>
                      <summary className={styles.secondary}>Cancelar agendamento</summary>
                      <form action={change} className={styles.form}>
                        <input type="hidden" name="change" value={booking.id} />
                        <input type="hidden" name="expected" value={booking.starts_at} />
                        <input type="hidden" name="operation" value="cancel" />
                        {booking.status === "in_progress" && <label className={styles.field}>
                          Motivo do cancelamento<input name="reason" required maxLength={280} />
                        </label>}
                        <button className={styles.danger}>Confirmar cancelamento</button>
                      </form>
                    </details>
                  )}
                  {view === "dia" && canManage && booking.can_complete && (
                    <form action={complete}>
                      <input type="hidden" name="completion" value={booking.id} />
                      <button type="submit" className={styles.secondary}>Concluir atendimento</button>
                    </form>
                  )}
                  {view === "dia" && canManage && booking.status === "confirmed" && (
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
                  {view === "dia" && canManage && booking.status === "completed" && booking.is_paid === false && (booking.price_cents ?? 0) > 0 && (
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

function civilDay(date: Date, offset: number) {
  return new Date(date.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}
