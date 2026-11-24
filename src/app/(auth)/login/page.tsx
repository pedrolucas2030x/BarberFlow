import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthNotice, AuthScreen } from "@/components/auth/auth-screen";
import styles from "@/components/auth/auth.module.css";
import { signIn } from "@/features/auth/actions";
import { isAuthAvailable } from "@/features/auth/availability";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<{ aviso?: string | string[] }>;

function LoginNotice({ aviso }: { aviso?: string | string[] }) {
  if (aviso === "link-invalido") {
    return <AuthNotice status="error">O link de confirmação é inválido, expirou ou já foi usado.</AuthNotice>;
  }
  if (aviso === "email-confirmado") {
    return <AuthNotice status="success">E-mail confirmado. Entre com a senha cadastrada.</AuthNotice>;
  }
  if (aviso === "senha-atualizada") {
    return <AuthNotice status="success">Senha atualizada. Entre com a nova senha.</AuthNotice>;
  }
  if (aviso === "saida-indisponivel") {
    return <AuthNotice status="error">Não foi possível encerrar a sessão. Volte ao <Link href="/painel" className={styles.inlineLink}>painel</Link> e tente sair novamente.</AuthNotice>;
  }
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const [available, { aviso }] = await Promise.all([isAuthAvailable(), searchParams]);

  return (
    <AuthScreen
      title="Entrar na sua conta"
      description="Acesse o painel da sua barbearia."
      footer={<>Primeira vez por aqui? <Link href="/cadastro" className={styles.inlineLink}>Crie sua conta</Link></>}
    >
      <LoginNotice aviso={aviso} />
      <AuthForm action={signIn} mode="login" disabled={!available} />
    </AuthScreen>
  );
}
