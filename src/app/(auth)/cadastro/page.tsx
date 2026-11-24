import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";
import styles from "@/components/auth/auth.module.css";
import { signUp } from "@/features/auth/actions";
import { isAuthAvailable } from "@/features/auth/availability";
import { newPasswordPolicy } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  const available = await isAuthAvailable();

  return (
    <AuthScreen
      title="Crie sua conta"
      description="Você vai poder configurar sua barbearia depois de confirmar o e-mail."
      footer={<>Já tem uma conta? <Link href="/login" className={styles.inlineLink}>Entrar</Link></>}
    >
      <AuthForm action={signUp} mode="signup" disabled={!available} passwordPolicy={newPasswordPolicy} />
    </AuthScreen>
  );
}
