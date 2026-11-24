import { z } from "zod";

const email = z.string().trim().max(254, "Informe um e-mail válido.").pipe(
  z.email({ error: "Informe um e-mail válido." }),
);

const minimumPasswordLength = 12;
export const newPasswordPolicy = {
  minimumLength: minimumPasswordLength,
  hint: "Use pelo menos " + minimumPasswordLength + " caracteres.",
};

const password = z.string()
  .min(1, "Informe a senha.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, {
    message: "A senha pode ter até 72 bytes. Acentos e símbolos podem ocupar mais de um byte.",
  });

const newPassword = password.refine((value) => [...value].length >= minimumPasswordLength, {
  message: newPasswordPolicy.hint,
});

export const signInSchema = z.object({ email, password });

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100, "Use até 100 caracteres."),
  email,
  password: newPassword,
});

export const recoverySchema = z.object({ email });

export const passwordResetSchema = z.object({
  password: newPassword,
  confirmPassword: z.string().min(1, "Confirme a nova senha."),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  path: ["confirmPassword"],
  message: "As senhas precisam ser iguais.",
});
