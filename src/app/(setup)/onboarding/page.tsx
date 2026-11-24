import { Store } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/features/workspace/access";
import { appTimeZone } from "@/lib/app-time-zone";
import styles from "../setup.module.css";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Cadastro da barbearia" };

export default async function OnboardingPage() {
  const workspace = await getWorkspace();
  if (workspace.state === "anonymous" || workspace.state === "unconfigured") redirect("/login");
  if (workspace.state === "ready") redirect(workspace.role === "barber" ? "/agenda" : "/painel");
  if (workspace.state !== "needs-onboarding") redirect("/acesso");

  return (
    <section className={styles.card} aria-labelledby="onboarding-heading">
      <span className="icon-tile"><Store size={19} aria-hidden="true" /></span>
      <h1 id="onboarding-heading">Cadastre sua barbearia</h1>
      <p>Preencha os dados do estabelecimento para acessar o painel como proprietário.</p>
      <OnboardingForm initialTimezone={appTimeZone} />
    </section>
  );
}
