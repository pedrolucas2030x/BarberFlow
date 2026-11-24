create schema barberflow_private;
revoke all on schema barberflow_private from public, anon, authenticated, service_role;
grant usage on schema barberflow_private to authenticated;

create type public.membership_role as enum ('owner', 'manager', 'barber');
revoke all on type public.membership_role from public, anon, authenticated, service_role;
grant usage on type public.membership_role to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (name = btrim(name) and char_length(name) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 100 and name !~ '[[:cntrl:]]'
  ),
  slug text not null unique check (
    char_length(slug) between 3 and 63 and slug collate "C" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  timezone text not null default 'America/Fortaleza' check (
    timezone = btrim(timezone) and char_length(timezone) between 1 and 100
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

revoke all on public.profiles, public.organizations, public.memberships
  from public, anon, authenticated, service_role;
grant select on public.profiles, public.organizations, public.memberships to authenticated;

create policy read_own_profile on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy read_own_memberships on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy read_member_organizations on public.organizations
  for select to authenticated
  using (
    id in (
      select membership.organization_id
      from public.memberships as membership
      where membership.user_id = (select auth.uid())
    )
  );

create function barberflow_private.profile_name(metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(metadata -> 'name') = 'string'
      and char_length(btrim(metadata ->> 'name')) between 2 and 100
    then btrim(metadata ->> 'name')
  end;
$$;

create function barberflow_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, barberflow_private.profile_name(new.raw_user_meta_data));
  return new;
end;
$$;

create trigger barberflow_create_profile
  after insert on auth.users
  for each row execute function barberflow_private.create_profile();

insert into public.profiles (user_id, name)
select id, barberflow_private.profile_name(raw_user_meta_data)
from auth.users
on conflict (user_id) do nothing;

create function barberflow_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger update_profile_timestamp
  before update on public.profiles
  for each row execute function barberflow_private.set_updated_at();

create trigger update_organization_timestamp
  before update on public.organizations
  for each row execute function barberflow_private.set_updated_at();

-- The Data API exposes the invoker wrapper and keeps privileged writes in a private schema.
create function barberflow_private.create_organization(p_name text, p_slug text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  organization_name text := btrim(p_name);
  organization_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from auth.users
    where id = caller_id and email_confirmed_at is not null and not is_anonymous
  ) then
    raise insufficient_privilege using message = 'A confirmed account is required to create an organization';
  end if;

  if organization_name is null or char_length(organization_name) not between 2 and 100
    or organization_name ~ '[[:cntrl:]]'
    or p_slug is null or char_length(p_slug) not between 3 and 63
    or p_slug collate "C" !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_timezone is null or char_length(p_timezone) not between 1 and 100
    or not exists (select 1 from pg_catalog.pg_timezone_names as zone where zone.name = p_timezone)
  then
    raise invalid_parameter_value using message = 'Invalid organization details';
  end if;

  -- Serialize first-time onboarding for the same authenticated account across requests.
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 683325449));

  select membership.organization_id into organization_id
  from public.memberships as membership
  join public.organizations as organization on organization.id = membership.organization_id
  where membership.user_id = caller_id and membership.role = 'owner' and organization.slug = p_slug;

  if found then
    return organization_id;
  end if;

  if exists (select 1 from public.memberships where user_id = caller_id) then
    raise insufficient_privilege using message = 'This account already belongs to an organization';
  end if;

  insert into public.organizations (name, slug, timezone)
  values (organization_name, p_slug, p_timezone)
  returning id into organization_id;

  insert into public.memberships (organization_id, user_id, role)
  values (organization_id, caller_id, 'owner');

  return organization_id;
end;
$$;

create function public.create_organization(p_name text, p_slug text, p_timezone text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select barberflow_private.create_organization(p_name, p_slug, p_timezone);
$$;

revoke all on function barberflow_private.profile_name(jsonb),
  barberflow_private.create_profile(), barberflow_private.set_updated_at(),
  barberflow_private.create_organization(text, text, text),
  public.create_organization(text, text, text) from public, anon, authenticated, service_role;

grant execute on function barberflow_private.create_organization(text, text, text),
  public.create_organization(text, text, text) to authenticated;
