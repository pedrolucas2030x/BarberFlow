export type AuthLinkType = "email" | "recovery";

export const authLinkPaths = {
  email: { pending: "/confirmar-email", invalid: "/login?aviso=link-invalido" },
  recovery: { pending: "/redefinir-senha", invalid: "/recuperar-senha?aviso=link-invalido" },
} as const;

const validTokenHash = /^[a-zA-Z0-9_-]{16,256}$/;

export function isAuthLinkToken(value: string | undefined): value is string {
  return typeof value === "string" && validTokenHash.test(value);
}

export function readAuthLink(searchParams: URLSearchParams): { type: AuthLinkType; token: string | null } | null {
  const types = searchParams.getAll("type");
  const type = types[0];
  if (types.length !== 1 || (type !== "email" && type !== "recovery")) return null;

  const tokens = searchParams.getAll("token_hash");
  const token = tokens.length === 1 && isAuthLinkToken(tokens[0]) ? tokens[0] : null;

  return { type, token };
}
