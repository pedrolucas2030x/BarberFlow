import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { getAppointmentCustomers, getBookableProfessionals } from "@/features/appointments/data";
import { appointmentDay, todayForAppointments } from "@/features/appointments/dates";
import { requireWorkspace } from "@/features/workspace/access";
import { AppointmentForm } from "./appointment-form";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage({ searchParams }: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { organization } = await requireWorkspace();
  const query = await searchParams;
  const today = todayForAppointments(organization.timezone);
  const selectedDay = appointmentDay(query.data);
  const day = selectedDay && selectedDay >= today ? selectedDay : today;
  const [professionals, customers] = await Promise.all([
    getBookableProfessionals(organization.id),
    getAppointmentCustomers(organization.id),
  ]);

  return (
    <>
      <div className="page-intro">
        <h1>Novo agendamento</h1>
        <p>Os horários usam o fuso da barbearia ({organization.timezone}).</p>
      </div>
      <section className={styles.panel} aria-labelledby="appointment-details">
        <h2 id="appointment-details" className={styles.panelHeading}>Dados do agendamento</h2>
        {(professionals === null || customers.failed) ? (
          <p role="alert" className={`${styles.error} mt-4`}>Não foi possível carregar os cadastros. Atualize a página e tente novamente.</p>
        ) : professionals.length === 0 ? (
          <p className={`${styles.muted} mt-4`}>Cadastre um <Link href="/servicos" className="inline-link">serviço ativo</Link> e vincule-o a um profissional ativo na <Link href="/equipe" className="inline-link">Equipe</Link>.</p>
        ) : (
          <AppointmentForm key={day} professionals={professionals} customers={customers} day={day} today={today} />
        )}
        {(professionals === null || !professionals.length || customers.failed || !customers.rows.length) && (
          <Link href={`/agenda?data=${day}`} className={`${styles.secondary} mt-4`}>Voltar à agenda</Link>
        )}
      </section>
    </>
  );
}
