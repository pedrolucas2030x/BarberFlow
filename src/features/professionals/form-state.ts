export type TeamFormState = {
  revision: number;
  status: "idle" | "success" | "error";
  message?: string;
  issues?: Partial<Record<string, string[]>>;
};

export const initialTeamFormState: TeamFormState = { revision: 0, status: "idle" };

export type TeamFormAction = (previous: TeamFormState, formData: FormData) => Promise<TeamFormState>;

export function teamFormError(previous: TeamFormState, message: string, issues?: TeamFormState["issues"]): TeamFormState {
  return { revision: previous.revision, status: "error", message, issues };
}

export function teamFormSuccess(previous: TeamFormState, message: string): TeamFormState {
  return { revision: previous.revision + 1, status: "success", message };
}
