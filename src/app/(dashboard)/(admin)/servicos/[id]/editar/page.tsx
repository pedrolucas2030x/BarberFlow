import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import styles from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "../../service-form";

export const metadata: Metadata = { title: "Editar serviço" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireWorkspace();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: service, error } = await supabase.from("services")
    .select("id, name, description, duration_minutes, price_cents, active")
    .eq("organization_id", organization.id).eq("id", id).maybeSingle();

  if (error) throw new Error("Não foi possível consultar o serviço.");
  if (!service) notFound();

  return (
    <>
      <div className="page-intro">
        <h1>Editar serviço</h1>
        <p>Atualize os dados de {service.name}.</p>
      </div>
      <section className={`panel ${styles.panel}`} aria-label="Dados do serviço">
        <ServiceForm service={service} />
      </section>
    </>
  );
}
