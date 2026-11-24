import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/features/workspace/access";
import styles from "../setup.module.css";

export const metadata: Metadata = { title: "Acesso à barbearia" };

export default async function WorkspaceAccessPage() {
  const workspace = await getWorkspace();
  if (workspace.state === "unconfigured" || workspace.state === "anonymous") redirect("/login");
  if (workspace.state === "needs-onboarding") redirect("/onboarding");
  if (workspace.state === "ready") redirect(workspace.role === "barber" ? "/agenda" : "/painel");

  return (
    <section className={styles.card} aria-labelledby="access-heading">
      <span className="icon-tile"><ShieldAlert size={19} aria-hidden="true" /></span>
      <h1 id="access-heading">Acesso à barbearia indisponível</h1>
      <p>{workspace.state === "inactive"
        ? "O estabelecimento vinculado à sua conta está inativo."
        : "Não foi possível verificar seu acesso neste momento. Tente novamente em instantes."}</p>
      <Link href="/painel" prefetch={false} className={`primary-button ${styles.retry}`}>Tentar acessar</Link>
    </section>
  );
}
