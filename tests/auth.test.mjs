import assert from "node:assert/strict";
import { test } from "node:test";
import { authLinkPaths, readAuthLink } from "../src/features/auth/email-flow.ts";
import { passwordResetSchema, recoverySchema, signInSchema, signUpSchema } from "../src/lib/validation/auth.ts";

const token = "a1b2c3d4".repeat(8);

test("link de e-mail aceita apenas fluxos previstos e ignora destinos enviados pelo cliente", () => {
  const query = new URLSearchParams({
    type: "email",
    token_hash: token,
    next: "https://outro.exemplo",
  });
  assert.deepEqual(readAuthLink(query), { type: "email", token });
  assert.equal(authLinkPaths.email.pending, "/confirmar-email");
  query.set("type", "recovery");
  assert.deepEqual(readAuthLink(query), { type: "recovery", token });
  assert.equal(authLinkPaths.recovery.pending, "/redefinir-senha");
  query.set("type", "invite");
  assert.equal(readAuthLink(query), null);
});

test("link ignora parâmetro repetido, token fora do formato e token ausente", () => {
  assert.equal(readAuthLink(new URLSearchParams("type=email&type=recovery")), null);
  const query = new URLSearchParams({ type: "recovery" });
  assert.deepEqual(readAuthLink(query), { type: "recovery", token: null });
  query.set("token_hash", "token com espaços e caracteres como &");
  assert.deepEqual(readAuthLink(query), { type: "recovery", token: null });
  query.set("token_hash", token);
  query.append("token_hash", token);
  assert.deepEqual(readAuthLink(query), { type: "recovery", token: null });
});

test("cadastro normaliza nome e e-mail preservando a senha exatamente como digitada", () => {
  const password = "  uma senha longa  ";
  const parsed = signUpSchema.parse({
    name: "  Nome da Pessoa  ",
    email: "  conta@exemplo.com ",
    password,
  });
  assert.deepEqual(parsed, { name: "Nome da Pessoa", email: "conta@exemplo.com", password });
});

test("senha curta é aceita no login de contas antigas e rejeitada para novas senhas", () => {
  const credentials = { email: "conta@exemplo.com", password: "antiga" };
  assert.equal(signInSchema.safeParse(credentials).success, true);
  assert.equal(signUpSchema.safeParse({ ...credentials, name: "Nome da Pessoa" }).success, false);
});

test("limite da senha considera bytes UTF-8 e comprimento mínimo conta caracteres Unicode", () => {
  const account = { email: "conta@exemplo.com", name: "Nome da Pessoa" };
  assert.equal(signUpSchema.safeParse({ ...account, password: "é".repeat(36) }).success, true);
  assert.equal(signUpSchema.safeParse({ ...account, password: "é".repeat(37) }).success, false);
  assert.equal(signUpSchema.safeParse({ ...account, password: "🙂".repeat(6) }).success, false);
});

test("recuperação valida o endereço e só aceita a nova senha com confirmação igual", () => {
  assert.equal(recoverySchema.safeParse({ email: "incompleto@" }).success, false);
  const password = "uma senha comprida";
  const reset = passwordResetSchema.safeParse({ password, confirmPassword: "outro valor" });
  assert.equal(reset.success, false);
  assert.deepEqual(reset.error.issues[0].path, ["confirmPassword"]);
  assert.equal(passwordResetSchema.safeParse({ password, confirmPassword: password }).success, true);
});
