import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { SectionPage } from "@/components/dashboard/section-page";
import { requireWorkspace } from "@/features/workspace/access";

const { label, icon } = navigation.services;
export const metadata: Metadata = { title: label };

export default async function ServicesPage() {
  await requireWorkspace();

  return (
    <SectionPage
      title={label}
      icon={icon}
      description="Consulte os serviços, as durações e os preços da barbearia."
      emptyTitle="Nenhum serviço para exibir"
      emptyDescription="O catálogo vai aparecer aqui quando o cadastro de serviços estiver disponível."
    />
  );
}
