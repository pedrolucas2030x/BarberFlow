import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthNotice, AuthScreen } from "@/components/auth/auth-screen";
import styles from "@/components/auth/auth.module.css";
import { requestPasswordReset } from "@/features/auth/actions";
import { isAuthAvailable } from "@/features/auth/availability";

export const metadata: Metadata = { title: "Recuperar senha" };

type SearchParams = Promise<{ aviso?: string | string[] }>;

function RecoveryNotice({ aviso }: { aviso?: string | string[] }) {
  if (aviso === "link-invalido") {
    return <AuthNotice status="error">O link é inválido, expirou ou já foi usado. Solicite um novo link abaixo.</AuthNotice>;
  }
  if (aviso === "senha-indisponivel") {
    return <AuthNotice status="error">Não foi possível salvar a nova senha. Solicite outro link e tente novamente.</AuthNotice>;
  }
  return null;
}

export default async function RecoveryPage({ searchParams }: { searchParams: SearchParams }) {
  const [available, { aviso }] = await Promise.all([isAuthAvailable(), searchParams]);

  return (
    <AuthScreen
      title="Recuperar senha"
      description="Informe o e-mail da sua conta para solicitar um link de recuperação."
      footer={<Link href="/login" className={styles.inlineLink}>Voltar para o login</Link>}
    >
      <RecoveryNotice aviso={aviso} />
      <AuthForm action={requestPasswordReset} mode="recovery" disabled={!available} />
    </AuthScreen>
  );
}
