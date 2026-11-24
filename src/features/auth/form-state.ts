export type AuthFieldName = "name" | "email" | "password" | "confirmPassword";

export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<AuthFieldName, string[]>>;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };

export type AuthFormAction = (previous: AuthFormState, data: FormData) => Promise<AuthFormState>;
