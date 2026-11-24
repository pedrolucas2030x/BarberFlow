create or replace function barberflow_private.create_appointment(
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

  if exists (
    select 1 from public.working_hours as shift
    where shift.organization_id = p_organization_id and shift.professional_id = p_professional_id
      and shift.weekday = extract(dow from local_start)
      and local_start::time < shift.break_ends_at and local_end::time > shift.break_starts_at
  ) then
    raise exception using errcode = 'BF004', message = 'during a break';
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

create function public.book_solo_appointment(
  p_organization_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_customer_id uuid, p_customer_name text, p_customer_phone text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  barber_id uuid;
begin
  if not exists (select 1 from barberflow_private.admin_organization_ids() as org(id) where id = p_organization_id) then
    raise exception using errcode = '42501', message = 'appointment access denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 912871));
  select id into barber_id from public.professionals
    where organization_id = p_organization_id and active order by created_at, id limit 1;
  if not found then
    insert into public.professionals (organization_id, name) values (p_organization_id, 'Barbeiro')
      returning id into barber_id;
  end if;

  if not exists (select 1 from public.services where organization_id = p_organization_id and id = p_service_id and active) then
    raise exception using errcode = 'BF002', message = 'service unavailable';
  end if;
  insert into public.professional_services (organization_id, professional_id, service_id)
    values (p_organization_id, barber_id, p_service_id) on conflict do nothing;

  if p_customer_id is not null then
    return public.create_appointment(p_organization_id, barber_id, p_service_id, p_customer_id, p_starts_at);
  end if;
  return public.book_with_customer_name(p_organization_id, barber_id, p_service_id,
    p_customer_name, p_customer_phone, p_starts_at);
end;
$$;

revoke execute on function public.book_solo_appointment(uuid, uuid, timestamptz, uuid, text, text) from public, anon, service_role;
grant execute on function public.book_solo_appointment(uuid, uuid, timestamptz, uuid, text, text) to authenticated;
