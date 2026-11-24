create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

alter table public.customers
  add constraint customers_organization_id_id_key unique (organization_id, id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  customer_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'canceled')),
  price_cents integer not null check (price_cents >= 0),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  check ((status = 'canceled') = (canceled_at is not null)),
  foreign key (organization_id, professional_id) references public.professionals (organization_id, id),
  foreign key (organization_id, service_id) references public.services (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id)
    on delete set null (customer_id),
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create index appointments_organization_starts_at_idx on public.appointments (organization_id, starts_at);
create index appointments_organization_customer_idx on public.appointments (organization_id, customer_id)
  where customer_id is not null;
create index appointments_organization_professional_idx on public.appointments (organization_id, professional_id);
create index appointments_organization_service_idx on public.appointments (organization_id, service_id);

alter table public.appointments enable row level security;
revoke all on public.appointments from public, anon, authenticated, service_role;

create function barberflow_private.create_appointment(
  p_organization_id uuid, p_professional_id uuid, p_service_id uuid, p_customer_id uuid, p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  timezone_name text;
  service_duration integer;
  service_price integer;
  professional_commission integer;
  booking_end timestamptz;
  local_start timestamp;
  local_end timestamp;
  appointment_id uuid;
begin
  select organization.timezone into timezone_name
    from public.organizations as organization
    where organization.id = p_organization_id
      and organization.id in (select barberflow_private.admin_organization_ids())
    for share;
  if not found then
    raise exception using errcode = '42501', message = 'appointment access denied';
  end if;

  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at < now() then
    raise exception using errcode = 'BF001', message = 'invalid appointment start';
  end if;

  -- Serialize booking attempts for the same professional before checking the exclusion constraint.
  select professional.commission_bps into professional_commission
    from public.professionals as professional
    where professional.organization_id = p_organization_id and professional.id = p_professional_id and professional.active
    for no key update;
  if not found then
    raise exception using errcode = 'BF002', message = 'professional unavailable';
  end if;

  select service.duration_minutes, service.price_cents into service_duration, service_price
    from public.professional_services as link
    join public.services as service on (service.organization_id, service.id) = (link.organization_id, link.service_id)
    where link.organization_id = p_organization_id and link.professional_id = p_professional_id
      and link.service_id = p_service_id and service.active
    for share of link, service;
  if not found then
    raise exception using errcode = 'BF002', message = 'service or professional unavailable';
  end if;

  perform 1 from public.customers where organization_id = p_organization_id and id = p_customer_id for key share;
  if not found then
    raise exception using errcode = 'BF003', message = 'customer unavailable';
  end if;

  booking_end := p_starts_at + make_interval(mins => service_duration);
  local_start := p_starts_at at time zone timezone_name;
  local_end := booking_end at time zone timezone_name;
  if extract(second from local_start) <> 0 or local_start::date <> local_end::date
    or local_end - local_start <> booking_end - p_starts_at then
    raise exception using errcode = 'BF004', message = 'outside working hours';
  end if;

  perform 1 from public.working_hours as shift
    where shift.organization_id = p_organization_id and shift.professional_id = p_professional_id
      and shift.weekday = extract(dow from local_start)
      and shift.starts_at <= local_start::time and shift.ends_at >= local_end::time
      and (shift.break_starts_at is null
        or local_end::time <= shift.break_starts_at or local_start::time >= shift.break_ends_at)
    for share;
  if not found then
    raise exception using errcode = 'BF004', message = 'outside working hours or during a break';
  end if;

  if exists (
    select 1 from public.time_off as block
    where block.organization_id = p_organization_id and block.professional_id = p_professional_id
      and block.starts_at < booking_end and block.ends_at > p_starts_at
  ) then
    raise exception using errcode = 'BF005', message = 'appointment intersects time off';
  end if;

  insert into public.appointments (
    organization_id, professional_id, service_id, customer_id, starts_at, ends_at, price_cents, commission_bps
  ) values (
    p_organization_id, p_professional_id, p_service_id, p_customer_id, p_starts_at, booking_end,
    service_price, professional_commission
  ) returning id into appointment_id;
  return appointment_id;
end;
$$;

create function barberflow_private.cancel_appointment(p_organization_id uuid, p_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from barberflow_private.admin_organization_ids() as ids(id) where id = p_organization_id) then
    raise exception using errcode = '42501', message = 'appointment access denied';
  end if;

  update public.appointments
    set status = 'canceled', canceled_at = now()
    where id = p_appointment_id and organization_id = p_organization_id and status = 'confirmed';
  return found;
end;
$$;

-- Only the customer name is needed by an assigned professional.
create function barberflow_private.list_appointments(p_organization_id uuid, p_day date)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status text,
  service_name text, professional_name text, customer_name text, price_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select appointment.id, appointment.starts_at, appointment.ends_at, appointment.status,
    service.name, professional.name, customer.name,
    case when membership.role in ('owner', 'manager') then appointment.price_cents end
  from public.memberships as membership
  join public.organizations as organization on organization.id = membership.organization_id
  join public.appointments as appointment on appointment.organization_id = organization.id
  join public.professionals as professional
    on (professional.organization_id, professional.id) = (organization.id, appointment.professional_id)
  join public.services as service
    on (service.organization_id, service.id) = (organization.id, appointment.service_id)
  left join public.customers as customer
    on (customer.organization_id, customer.id) = (organization.id, appointment.customer_id)
  where membership.user_id = (select auth.uid()) and organization.id = p_organization_id
    and organization.status = 'active'
    and (membership.role in ('owner', 'manager') or professional.membership_id = membership.id)
    and appointment.starts_at >= (p_day::timestamp at time zone organization.timezone)
    and appointment.starts_at < ((p_day + 1)::timestamp at time zone organization.timezone)
  order by appointment.starts_at, appointment.id;
$$;

create function public.create_appointment(
  p_organization_id uuid, p_professional_id uuid, p_service_id uuid, p_customer_id uuid, p_starts_at timestamptz
)
returns uuid language sql security invoker set search_path = '' as $$
  select barberflow_private.create_appointment(p_organization_id, p_professional_id, p_service_id, p_customer_id, p_starts_at);
$$;

create function public.cancel_appointment(p_organization_id uuid, p_appointment_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select barberflow_private.cancel_appointment(p_organization_id, p_appointment_id);
$$;

create function public.list_appointments(p_organization_id uuid, p_day date)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status text,
  service_name text, professional_name text, customer_name text, price_cents integer
)
language sql stable security invoker set search_path = '' as $$
  select * from barberflow_private.list_appointments(p_organization_id, p_day)
  order by starts_at, id;
$$;

revoke execute on function
  barberflow_private.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  barberflow_private.cancel_appointment(uuid, uuid),
  barberflow_private.list_appointments(uuid, date),
  public.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  public.cancel_appointment(uuid, uuid),
  public.list_appointments(uuid, date)
from public, anon, authenticated, service_role;

grant execute on function
  barberflow_private.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  barberflow_private.cancel_appointment(uuid, uuid),
  barberflow_private.list_appointments(uuid, date),
  public.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  public.cancel_appointment(uuid, uuid),
  public.list_appointments(uuid, date)
to authenticated;
