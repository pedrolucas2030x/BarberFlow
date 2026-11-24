import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";
import styles from "@/components/auth/auth.module.css";
import { resetPassword } from "@/features/auth/actions";
import { authLinkPaths } from "@/features/auth/email-flow";
import { getAuthLinkToken } from "@/features/auth/link-cookie";
import { newPasswordPolicy } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage() {
  if (!(await getAuthLinkToken("recovery"))) redirect(authLinkPaths.recovery.invalid);

  return (
    <AuthScreen
      title="Redefinir senha"
      description="Crie uma nova senha para acessar sua conta."
      footer={<Link href="/recuperar-senha" className={styles.inlineLink}>Solicitar outro link</Link>}
    >
      <AuthForm action={resetPassword} mode="reset" passwordPolicy={newPasswordPolicy} />
    </AuthScreen>
  );
}
