import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { SectionPage } from "@/components/dashboard/section-page";
import { requireWorkspace } from "@/features/workspace/access";

const { label, icon } = navigation.schedule;
export const metadata: Metadata = { title: label };

export default async function SchedulePage() {
  await requireWorkspace("member");

  return (
    <SectionPage
      title={label}
      icon={icon}
      description="Organize os horários e acompanhe os atendimentos."
      emptyTitle="Nenhum agendamento para exibir"
      emptyDescription="Os horários vão aparecer aqui quando o agendamento estiver disponível."
    />
  );
}
