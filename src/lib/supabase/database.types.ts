export type WorkspaceRole = "owner" | "manager" | "barber";

export type PaymentMethod = "pix" | "cash" | "debit" | "credit";

export type ReceivedPaymentsDay = {
  total_cents: number;
  payments: {
    appointment_id: string;
    amount_cents: number;
    method: PaymentMethod;
    received_at: string;
    starts_at: string;
    service_name: string;
    professional_name: string;
  }[];
};

export type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "canceled" | "completed";
  service_name: string;
  professional_name: string;
  customer_name: string | null;
  price_cents: number | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

type RegistryTable<Fields, Defaulted extends keyof Fields = never, Fixed extends keyof Fields = never> = {
  Row: { id: string; organization_id: string; created_at: string; updated_at: string } & Fields;
  Insert: { organization_id: string } & Omit<Fields, Defaulted> & Partial<Pick<Fields, Defaulted>>;
  Update: Partial<Omit<Fields, Fixed>>;
  Relationships: [];
};

type ProfessionalService = { organization_id: string; professional_id: string; service_id: string };

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
      services: RegistryTable<{
        name: string;
        duration_minutes: number;
        price_cents: number;
        active: boolean;
      }, "active">;
      customers: RegistryTable<{
        name: string;
        phone: string | null;
        marketing_consent: boolean;
      }, "marketing_consent">;
      professionals: RegistryTable<{
        membership_id: string | null;
        name: string;
        active: boolean;
        commission_bps: number;
      }, "membership_id" | "active" | "commission_bps">;
      professional_services: {
        Row: ProfessionalService & { created_at: string };
        Insert: ProfessionalService;
        Update: never;
        Relationships: [];
      };
      working_hours: RegistryTable<{
        professional_id: string;
        weekday: number;
        starts_at: string;
        ends_at: string;
        break_starts_at: string | null;
        break_ends_at: string | null;
      }, "break_starts_at" | "break_ends_at", "professional_id">;
      time_off: RegistryTable<{
        professional_id: string;
        starts_at: string;
        ends_at: string;
        reason: string | null;
      }, "reason", "professional_id">;
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone: string };
        Returns: string;
      };
      create_appointment: {
        Args: {
          p_organization_id: string;
          p_professional_id: string;
          p_service_id: string;
          p_customer_id: string;
          p_starts_at: string;
        };
        Returns: string;
      };
      cancel_appointment: {
        Args: { p_organization_id: string; p_appointment_id: string };
        Returns: boolean;
      };
      book_with_customer_name: {
        Args: {
          p_organization_id: string; p_professional_id: string; p_service_id: string;
          p_customer_name: string; p_customer_phone: string | null; p_starts_at: string;
        };
        Returns: string;
      };
      list_appointments: {
        Args: { p_organization_id: string; p_day: string };
        Returns: Appointment[];
      };
      list_appointments_with_payments: {
        Args: { p_organization_id: string; p_day: string };
        Returns: (Appointment & { is_paid: boolean | null; can_complete: boolean })[];
      };
      complete_appointment: {
        Args: { p_organization_id: string; p_appointment_id: string };
        Returns: boolean;
      };
      record_appointment_payment: {
        Args: { p_organization_id: string; p_appointment_id: string; p_method: PaymentMethod };
        Returns: undefined;
      };
      received_payments_day: {
        Args: { p_organization_id: string; p_day: string };
        Returns: ReceivedPaymentsDay;
      };
    };
    Enums: { membership_role: WorkspaceRole };
    CompositeTypes: Record<never, never>;
  };
};
