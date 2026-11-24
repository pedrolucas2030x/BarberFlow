import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { SectionPage } from "@/components/dashboard/section-page";
import { requireWorkspace } from "@/features/workspace/access";

const { label, icon } = navigation.team;
export const metadata: Metadata = { title: label };

export default async function TeamPage() {
  await requireWorkspace();

  return (
    <SectionPage
      title={label}
      icon={icon}
      description="Consulte os profissionais e seus horários de trabalho."
      emptyTitle="Nenhum profissional para exibir"
      emptyDescription="Os profissionais vão aparecer aqui quando o cadastro da equipe estiver disponível."
    />
  );
}
