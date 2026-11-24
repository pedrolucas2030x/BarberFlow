export type WorkspaceRole = "owner" | "manager" | "barber";

type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { user_id: string; name: string | null; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organizations: {
        Row: Organization;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memberships: {
        Row: { id: string; organization_id: string; user_id: string; role: WorkspaceRole; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone: string };
        Returns: string;
      };
    };
    Enums: { membership_role: WorkspaceRole };
    CompositeTypes: Record<never, never>;
  };
};
