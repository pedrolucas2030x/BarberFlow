"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { initialAuthFormState, type AuthFieldName, type AuthFormAction, type AuthFormState } from "@/features/auth/form-state";
import type { newPasswordPolicy } from "@/lib/validation/auth";
import { AuthNotice } from "./auth-screen";
import styles from "./auth.module.css";

const labels: Record<AuthFieldName, string> = {
  name: "Nome completo",
  email: "E-mail",
  password: "Senha",
  confirmPassword: "Confirme a nova senha",
};

const inputs = {
  login: ["email", "password"],
  signup: ["name", "email", "password"],
  recovery: ["email"],
  reset: ["password", "confirmPassword"],
  confirm: [],
} as const satisfies Record<string, readonly AuthFieldName[]>;

type Mode = keyof typeof inputs;
type PasswordPolicy = typeof newPasswordPolicy;

const buttons: Record<Mode, [label: string, pendingLabel: string]> = {
  login: ["Entrar", "Entrando…"],
  signup: ["Criar conta", "Criando conta…"],
  recovery: ["Enviar link de recuperação", "Solicitando link…"],
  reset: ["Salvar nova senha", "Salvando senha…"],
  confirm: ["Confirmar e-mail", "Confirmando…"],
};

function PasswordInput({ field, label, policy, error, disabled }: {
  field: "password" | "confirmPassword";
  label: string;
  policy?: PasswordPolicy;
  error?: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const id = "auth-" + field;
  const hint = field === "password" ? policy?.hint : undefined;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id}>{label}</label>
        {!policy && <Link href="/recuperar-senha" className={styles.inlineLink}>Esqueci a senha</Link>}
      </div>
      <div className={styles.passwordInput}>
        <input
          type={visible ? "text" : "password"}
          id={id}
          name={field}
          autoComplete={policy ? "new-password" : "current-password"}
          minLength={policy?.minimumLength}
          maxLength={72}
          required
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-error" : hint ? id + "-hint" : undefined}
        />
        <button
          type="button"
          className={styles.togglePassword}
          aria-label={(visible ? "Ocultar " : "Exibir ") + (field === "password" ? "senha" : "confirmação de senha")}
          aria-controls={id}
          disabled={disabled}
          onClick={() => setVisible(!visible)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
      {error ? <p id={id + "-error"} className={styles.fieldError} role="alert">{error}</p> : (
        hint && <p id={id + "-hint"} className={styles.fieldHint}>{hint}</p>
      )}
    </div>
  );
}

export function AuthForm({ mode, action, disabled = false, passwordPolicy }: {
  mode: Mode;
  action: AuthFormAction;
  disabled?: boolean;
  passwordPolicy?: PasswordPolicy;
}) {
  const [state, formAction, pending] = useActionState(action, initialAuthFormState);
  const [values, setValues] = useState({ name: "", email: "" });
  const [dismissedResult, setDismissedResult] = useState<AuthFormState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const [label, pendingLabel] = buttons[mode];
  const showEmailResult = (mode === "signup" || mode === "recovery") && state.status === "success" && state !== dismissedResult;

  useEffect(() => {
    if (showEmailResult) {
      resultRef.current?.focus();
    } else if (state.status === "error") {
      const target = formRef.current?.querySelector<HTMLElement>('input[aria-invalid="true"]')
        ?? formRef.current?.querySelector<HTMLElement>('[data-auth-error]');
      target?.focus();
    } else if (dismissedResult && state === dismissedResult) {
      formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
    }
  }, [dismissedResult, showEmailResult, state]);

  if (showEmailResult) {
    return (
      <div className={styles.emailResult}>
        <h2 ref={resultRef} tabIndex={-1}>Confira sua caixa de entrada</h2>
        <p>{state.message}</p>
        <Link href="/login" className="primary-button">Ir para o login <ArrowRight size={17} aria-hidden="true" /></Link>
        <button type="button" className={styles.inlineLink} onClick={() => setDismissedResult(state)}>
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className={styles.form} action={formAction} aria-busy={pending}>
      {disabled && <AuthNotice status="error">A conexão com o serviço de acesso ainda não foi configurada.</AuthNotice>}
      {state.status === "error" && state.message && (
        <div data-auth-error tabIndex={-1}><AuthNotice status="error">{state.message}</AuthNotice></div>
      )}
      {state.status === "success" && state !== dismissedResult && state.message && (
        <AuthNotice status="success">{state.message}</AuthNotice>
      )}

      {inputs[mode].map((field) => {
        const error = state.fieldErrors?.[field]?.[0];
        const id = "auth-" + field;

        if (field === "password" || field === "confirmPassword") {
          return (
            <PasswordInput
              key={field}
              field={field}
              label={mode === "reset" && field === "password" ? "Nova senha" : labels[field]}
              policy={passwordPolicy}
              error={error}
              disabled={disabled}
            />
          );
        }

        return (
          <div className={styles.field} key={field}>
            <label htmlFor={id}>{labels[field]}</label>
            <input
              type={field === "email" ? "email" : "text"}
              id={id}
              name={field}
              autoComplete={field === "email" && mode === "login" ? "username" : field}
              autoCapitalize={field === "email" ? "none" : "words"}
              spellCheck={field === "email" ? false : undefined}
              maxLength={field === "email" ? 254 : 100}
              value={values[field]}
              onChange={(event) => setValues({ ...values, [field]: event.currentTarget.value })}
              required
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? id + "-error" : undefined}
            />
            {error && <p id={id + "-error"} className={styles.fieldError} role="alert">{error}</p>}
          </div>
        );
      })}

      <button type="submit" className={"primary-button " + styles.submit} disabled={pending || disabled}>
        {pending ? pendingLabel : label}
        {!pending && <ArrowRight size={17} aria-hidden="true" />}
      </button>
    </form>
  );
}
