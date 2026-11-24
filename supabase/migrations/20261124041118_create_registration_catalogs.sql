-- Composite references preserve the organization even when a supplied UUID exists elsewhere.
alter table public.memberships
  add constraint memberships_organization_id_id_key unique (organization_id, id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 100 and name !~ '[[:cntrl:]]'),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index services_organization_name_key on public.services (organization_id, lower(name));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 100 and name !~ '[[:cntrl:]]'),
  phone text not null check (phone collate "C" ~ '^[+][1-9][0-9]{7,14}$'),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 100 and name !~ '[[:cntrl:]]'),
  active boolean not null default true,
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, membership_id),
  foreign key (organization_id, membership_id)
    references public.memberships (organization_id, id) on delete set null (membership_id)
);

create table public.professional_services (
  organization_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, professional_id, service_id),
  foreign key (organization_id, professional_id)
    references public.professionals (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id)
    references public.services (organization_id, id) on delete cascade
);

create index professional_services_organization_service_idx
  on public.professional_services (organization_id, service_id);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  break_starts_at time,
  break_ends_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, professional_id, weekday),
  foreign key (organization_id, professional_id)
    references public.professionals (organization_id, id) on delete cascade,
  check (starts_at < ends_at and ends_at < time '24:00'
    and extract(second from starts_at) = 0 and extract(second from ends_at) = 0),
  check (
    (break_starts_at is null and break_ends_at is null)
    or (break_starts_at is not null and break_ends_at is not null
      and starts_at < break_starts_at and break_starts_at < break_ends_at and break_ends_at < ends_at
      and extract(second from break_starts_at) = 0 and extract(second from break_ends_at) = 0)
  )
);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (
    reason is null or (reason = btrim(reason) and char_length(reason) between 1 and 160 and reason !~ '[[:cntrl:]]')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, professional_id)
    references public.professionals (organization_id, id) on delete cascade,
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at)
);

create index time_off_organization_professional_start_idx
  on public.time_off (organization_id, professional_id, starts_at);

create trigger update_service_timestamp
  before update on public.services for each row execute function barberflow_private.set_updated_at();
create trigger update_customer_timestamp
  before update on public.customers for each row execute function barberflow_private.set_updated_at();
create trigger update_professional_timestamp
  before update on public.professionals for each row execute function barberflow_private.set_updated_at();
create trigger update_working_hours_timestamp
  before update on public.working_hours for each row execute function barberflow_private.set_updated_at();
create trigger update_time_off_timestamp
  before update on public.time_off for each row execute function barberflow_private.set_updated_at();

alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;

create function barberflow_private.admin_organization_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select membership.organization_id
  from public.memberships as membership
  join public.organizations as organization on organization.id = membership.organization_id
  where membership.user_id = (select auth.uid())
    and membership.role in ('owner', 'manager')
    and organization.status = 'active';
$$;

revoke execute on function barberflow_private.admin_organization_ids() from public, anon, authenticated, service_role;
grant execute on function barberflow_private.admin_organization_ids() to authenticated;

create policy manage_services on public.services for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));
create policy manage_customers on public.customers for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));
create policy manage_professionals on public.professionals for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));
create policy manage_professional_services on public.professional_services for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));
create policy manage_working_hours on public.working_hours for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));
create policy manage_time_off on public.time_off for all to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()))
  with check (organization_id in (select barberflow_private.admin_organization_ids()));

revoke all on public.services, public.customers, public.professionals, public.professional_services,
  public.working_hours, public.time_off from public, anon, authenticated, service_role;
grant select on public.services, public.customers, public.professionals, public.professional_services,
  public.working_hours, public.time_off to authenticated;

grant insert (organization_id, name, duration_minutes, price_cents, active),
  update (name, duration_minutes, price_cents, active) on public.services to authenticated;
grant insert (organization_id, name, phone, marketing_consent),
  update (name, phone, marketing_consent), delete on public.customers to authenticated;
grant insert (organization_id, membership_id, name, active, commission_bps),
  update (membership_id, name, active, commission_bps) on public.professionals to authenticated;
grant insert (organization_id, professional_id, service_id), delete on public.professional_services to authenticated;
grant insert (organization_id, professional_id, weekday, starts_at, ends_at, break_starts_at, break_ends_at),
  update (weekday, starts_at, ends_at, break_starts_at, break_ends_at), delete on public.working_hours to authenticated;
grant insert (organization_id, professional_id, starts_at, ends_at, reason),
  update (starts_at, ends_at, reason), delete on public.time_off to authenticated;
