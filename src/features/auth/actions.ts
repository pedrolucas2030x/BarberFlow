"use server";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl, getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { passwordResetSchema, recoverySchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { authLinkPaths, type AuthLinkType } from "./email-flow";
import type { AuthFormState } from "./form-state";
import { clearAuthLinkToken, getAuthLinkToken } from "./link-cookie";

const unavailable: AuthFormState = {
  status: "error",
  message: "O serviço de acesso está indisponível no momento. Tente novamente mais tarde.",
};

const retryLater: AuthFormState = {
  status: "error",
  message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
};

function createTemporaryAuth(config: NonNullable<ReturnType<typeof getSupabaseConfig>>) {
  return createSupabaseClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth;
}

export async function signIn(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: data.get("email"),
    password: data.get("password"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (!getAppUrl() || !getSupabaseConfig()) return unavailable;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.status === 429) return retryLater;
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Confirme seu e-mail pelo link recebido antes de entrar." };
    }
    if (error.code === "invalid_credentials") {
      return { status: "error", message: "E-mail ou senha inválidos." };
    }
    return unavailable;
  }

  await clearAuthLinkToken("email");
  await clearAuthLinkToken("recovery");
  redirect("/painel");
}

export async function signUp(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: data.get("name"),
    email: data.get("email"),
    password: data.get("password"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const appUrl = getAppUrl();
  if (!appUrl || !getSupabaseConfig()) return unavailable;

  const supabase = await createClient();
  const { name, email, password } = parsed.data;
  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: new URL("/auth/confirm", appUrl).toString(),
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: ["Escolha uma senha mais forte."] } };
    }
    if (error.status === 429 && error.code !== "over_email_send_rate_limit") return retryLater;
    const emailRelatedErrors = ["user_already_exists", "email_exists", "over_email_send_rate_limit"];
    if (!error.code || !emailRelatedErrors.includes(error.code)) return unavailable;
  }

  if (authData.session) redirect("/painel");

  return {
    status: "success",
    message: "Confira sua caixa de entrada e o spam. Se o cadastro foi aceito, você receberá um link para confirmar o e-mail.",
  };
}

export async function requestPasswordReset(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const parsed = recoverySchema.safeParse({ email: data.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const appUrl = getAppUrl();
  if (!appUrl || !getSupabaseConfig()) return unavailable;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: new URL("/auth/confirm", appUrl).toString(),
  });

  return {
    status: "success",
    message: "Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também o spam.",
  };
}

async function verifyLink(auth: SupabaseClient["auth"], type: AuthLinkType) {
  const token = await getAuthLinkToken(type);
  if (!token) redirect(authLinkPaths[type].invalid);

  const { data, error } = await auth.verifyOtp({ token_hash: token, type });

  await clearAuthLinkToken(type);
  if (error || !data.session) redirect(authLinkPaths[type].invalid);
}

export async function confirmEmail(): Promise<AuthFormState> {
  const config = getSupabaseConfig();
  if (!config) return unavailable;

  const auth = createTemporaryAuth(config);
  await verifyLink(auth, "email");
  await auth.signOut({ scope: "local" });
  await clearAuthLinkToken("recovery");
  redirect("/login?aviso=email-confirmado");
}

export async function resetPassword(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const parsed = passwordResetSchema.safeParse({
    password: data.get("password"),
    confirmPassword: data.get("confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const config = getSupabaseConfig();
  if (!config) return unavailable;

  // A sessão de recuperação só existe durante a ação e não substitui os cookies do navegador.
  const auth = createTemporaryAuth(config);
  await verifyLink(auth, "recovery");
  const { error } = await auth.updateUser({ password: parsed.data.password });
  if (error) {
    await auth.signOut({ scope: "local" });
    redirect("/recuperar-senha?aviso=senha-indisponivel");
  }

  await auth.signOut({ scope: "global" });
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await clearAuthLinkToken("email");
  redirect("/login?aviso=senha-atualizada");
}

export async function signOut() {
  await clearAuthLinkToken("email");
  await clearAuthLinkToken("recovery");

  if (getSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) redirect("/login?aviso=saida-indisponivel");
  }

  redirect("/login");
}
