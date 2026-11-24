import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { getAppointmentCustomers, getActiveAppointmentServices } from "@/features/appointments/data";
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
  const [services, customers] = await Promise.all([
    getActiveAppointmentServices(organization.id),
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
        {(services === null || customers.failed) ? (
          <p role="alert" className={`${styles.error} mt-4`}>Não foi possível carregar os cadastros. Atualize a página e tente novamente.</p>
        ) : services.length === 0 ? (
          <p className={`${styles.muted} mt-4`}>Cadastre seu <Link href="/servicos/novo" className="text-link">primeiro serviço</Link> para começar a agendar.</p>
        ) : (
          <AppointmentForm key={day} services={services} customers={customers} day={day} today={today} />
        )}
        {(services === null || !services.length || customers.failed) && (
          <Link href={`/agenda?data=${day}`} className={`${styles.secondary} mt-4`}>Voltar à agenda</Link>
        )}
      </section>
    </>
  );
}
