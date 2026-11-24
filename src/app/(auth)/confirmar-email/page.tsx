import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";
import styles from "@/components/auth/auth.module.css";
import { confirmEmail } from "@/features/auth/actions";
import { authLinkPaths } from "@/features/auth/email-flow";
import { getAuthLinkToken } from "@/features/auth/link-cookie";

export const metadata: Metadata = { title: "Confirmar e-mail" };

export default async function ConfirmEmailPage() {
  if (!(await getAuthLinkToken("email"))) redirect(authLinkPaths.email.invalid);

  return (
    <AuthScreen
      title="Confirmar e-mail"
      description="Confirme o endereço para ativar sua conta BarberFlow."
      footer={<Link href="/login" className={styles.inlineLink}>Voltar para o login</Link>}
    >
      <AuthForm action={confirmEmail} mode="confirm" />
    </AuthScreen>
  );
}
