import { Scissors } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import styles from "@/components/dashboard/registry.module.css";
import { todayForAppointments } from "@/features/appointments/dates";
import { publicCatalog } from "@/features/public-booking/data";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Agendar atendimento", robots: { index: false, follow: false } };

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  if (slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const { catalog, unavailable } = await publicCatalog(slug);
  if (!catalog && !unavailable) notFound();
  const today = catalog ? todayForAppointments(catalog.timezone) : "";
  const limit = today ? new Date(Date.parse(`${today}T00:00:00Z`) + 59 * 86_400_000).toISOString().slice(0, 10) : "";

  return <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
    <div className="page-intro">
      <span className="brand-mark"><Scissors size={18} aria-hidden /></span>
      <h1>{catalog?.name ?? "Agendamento"}</h1>
      {catalog && <p>Escolha um atendimento e um horário.</p>}
    </div>
    <section className={styles.panel} aria-label="Marcar atendimento">
      {unavailable ? <p role="alert">Agendamento temporariamente indisponível. Tente novamente mais tarde.</p>
        : catalog?.offers.length ? <BookingForm slug={slug} catalog={catalog} today={today} limit={limit} />
        : <p>Esta barbearia ainda não tem horários para reserva online.</p>}
    </section>
  </main>;
}
