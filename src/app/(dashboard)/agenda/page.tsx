import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { cancelAppointment } from "@/features/appointments/actions";
import { listAppointments } from "@/features/appointments/data";
import { adjacentAppointmentDay, appointmentDay, todayForAppointments } from "@/features/appointments/dates";
import { requireWorkspace } from "@/features/workspace/access";

export const metadata: Metadata = { title: "Agenda" };

const displayDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

        {resultado === "criado" && <p role="status" className={`${styles.success} mt-4`}>Agendamento criado.</p>}
        {resultado === "cancelado" && <p role="status" className={`${styles.success} mt-4`}>Agendamento cancelado.</p>}
        {resultado === "erro" && <p role="alert" className={`${styles.error} mt-4`}>Não foi possível cancelar este agendamento. Atualize a agenda e tente novamente.</p>}
        {!bookings && <p role="alert" className={`${styles.error} mt-4`}>Não foi possível consultar os agendamentos. Tente novamente.</p>}
        {bookings?.length === 0 && <p className={`${styles.muted} mt-4`}>Nenhum agendamento para este dia.</p>}
        {bookings && bookings.length > 0 && (
          <ul className={styles.list}>
            {bookings.map((booking) => {
              const canceled = booking.status === "canceled";
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
                        {booking.price_cents !== null && ` · ${currency.format(booking.price_cents / 100)}`}
                      </p>
                    </div>
                    <span className={styles.badge}>{canceled ? "Cancelado" : "Confirmado"}</span>
                  </div>
                  {canManage && !canceled && (
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
