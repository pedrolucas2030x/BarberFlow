alter table public.appointments
  drop constraint appointments_status_check,
  drop constraint appointments_no_overlap,
  add constraint appointments_status_check check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show')),
  add constraint appointments_no_overlap exclude using gist (
    professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('canceled', 'no_show')),
  add column updated_at timestamptz not null default now(),
  add column status_reason text check (char_length(status_reason) <= 280);

create table barberflow_private.appointment_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  appointment_id uuid not null,
  actor_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  action text not null,
  previous_start timestamptz,
  previous_end timestamptz,
  current_start timestamptz not null,
  current_end timestamptz not null,
  status text not null,
  foreign key (organization_id, appointment_id) references public.appointments (organization_id, id) on delete cascade
);
create index appointment_events_appointment_idx on barberflow_private.appointment_events (organization_id, appointment_id);

create function barberflow_private.audit_appointment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (old.starts_at, old.ends_at, old.status) is distinct from (new.starts_at, new.ends_at, new.status) then
    insert into barberflow_private.appointment_events
      (organization_id, appointment_id, actor_id, action, previous_start, previous_end, current_start, current_end, status)
    values (new.organization_id, new.id, auth.uid(),
      case when tg_op = 'INSERT' then 'created' when old.starts_at <> new.starts_at then 'rescheduled' else 'status' end,
      old.starts_at, old.ends_at, new.starts_at, new.ends_at, new.status);
  end if;
  return null;
end;
$$;
create trigger audit_appointments after insert or update on public.appointments
  for each row execute function barberflow_private.audit_appointment();
revoke execute on function barberflow_private.audit_appointment() from public, anon, authenticated, service_role;

create function barberflow_private.slot_fits(
  org_id uuid, barber_id uuid, begins timestamptz, finishes timestamptz, zone text,
  strict_hours boolean, ignore_id uuid default null
) returns boolean language sql stable set search_path = '' as $$
  select begins >= now() and finishes > begins
    and (begins at time zone zone)::date = (finishes at time zone zone)::date
    and (finishes at time zone zone) - (begins at time zone zone) = finishes - begins
    and (not strict_hours or exists (
      select 1 from public.working_hours w
      where w.organization_id = org_id and w.professional_id = barber_id
        and w.weekday = extract(dow from begins at time zone zone)
        and w.starts_at <= (begins at time zone zone)::time and w.ends_at >= (finishes at time zone zone)::time
    ))
    and not exists (
      select 1 from public.working_hours w where w.organization_id = org_id and w.professional_id = barber_id
        and w.weekday = extract(dow from begins at time zone zone)
        and w.break_starts_at < (finishes at time zone zone)::time and w.break_ends_at > (begins at time zone zone)::time
    )
    and not exists (
      select 1 from public.time_off b where b.organization_id = org_id and b.professional_id = barber_id
        and b.starts_at < finishes and b.ends_at > begins
    )
    and not exists (
      select 1 from public.appointments a where a.organization_id = org_id and a.professional_id = barber_id
        and a.status not in ('canceled', 'no_show') and a.id is distinct from ignore_id
        and a.starts_at < finishes and a.ends_at > begins
    );
$$;
revoke execute on function barberflow_private.slot_fits(uuid, uuid, timestamptz, timestamptz, text, boolean, uuid)
  from public, anon, authenticated, service_role;

create function barberflow_private.change_appointment(
  p_organization_id uuid, p_appointment_id uuid, p_action text, p_expected timestamptz,
  p_starts_at timestamptz, p_reason text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  item public.appointments%rowtype;
  zone text;
  finish timestamptz;
  target text;
begin
  if not exists (select 1 from barberflow_private.admin_organization_ids() as allowed(id) where id = p_organization_id) then
    raise insufficient_privilege;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 912871));
  select * into item from public.appointments
    where organization_id = p_organization_id and id = p_appointment_id for update;
  if not found or item.starts_at is distinct from p_expected then return false; end if;

  if p_action = 'reschedule' then
    if item.status not in ('pending', 'confirmed') or item.starts_at <= now() or not isfinite(p_starts_at) or p_starts_at is null then return false; end if;
    perform 1 from public.professional_services l
      join public.professionals p on (p.organization_id, p.id) = (l.organization_id, l.professional_id)
      join public.services s on (s.organization_id, s.id) = (l.organization_id, l.service_id)
      where l.organization_id = p_organization_id and l.professional_id = item.professional_id and l.service_id = item.service_id
        and p.active and s.active for share of l,p,s;
    if not found then return false; end if;
    select timezone into zone from public.organizations where id = p_organization_id;
    finish := p_starts_at + (item.ends_at - item.starts_at);
    if not barberflow_private.slot_fits(p_organization_id, item.professional_id, p_starts_at, finish, zone, false, item.id) then return false; end if;
    update public.appointments set starts_at = p_starts_at, ends_at = finish, updated_at = clock_timestamp() where id = item.id;
    return true;
  end if;

  target := case
    when p_action = 'confirm' and item.status = 'pending' then 'confirmed'
    when p_action = 'start' and item.status = 'confirmed' and item.starts_at <= now() then 'in_progress'
    when p_action = 'complete' and item.status = 'in_progress' then 'completed'
    when p_action = 'no_show' and item.status = 'confirmed' and item.starts_at <= now() then 'no_show'
    when p_action = 'cancel' and item.status = 'pending' then 'canceled'
    when p_action = 'cancel' and item.status = 'in_progress' and char_length(btrim(p_reason)) between 1 and 280 then 'canceled'
  end;
  if target is null then return false; end if;
  update public.appointments set status = target, updated_at = clock_timestamp(),
    completed_at = case when target = 'completed' then now() end,
    canceled_at = case when target = 'canceled' then now() end,
    status_reason = case when target = 'canceled' then nullif(btrim(p_reason), '') end
  where id = item.id;
  return true;
end;
$$;

create function public.change_appointment(
  p_organization_id uuid, p_appointment_id uuid, p_action text,
  p_expected timestamptz, p_starts_at timestamptz, p_reason text
)
returns boolean language sql security invoker set search_path = '' as $$
  select barberflow_private.change_appointment($1,$2,$3,$4,$5,$6);
$$;
revoke execute on function public.change_appointment(uuid,uuid,text,timestamptz,timestamptz,text),
  barberflow_private.change_appointment(uuid,uuid,text,timestamptz,timestamptz,text) from public, anon, service_role;
grant execute on function public.change_appointment(uuid,uuid,text,timestamptz,timestamptz,text),
  barberflow_private.change_appointment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create function barberflow_private.guard_schedule_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org_id uuid := coalesce(new.organization_id, old.organization_id);
  barber_id uuid := coalesce(new.professional_id, old.professional_id);
  zone text;
begin
  perform pg_advisory_xact_lock(hashtextextended(org_id::text, 912871));
  if tg_table_name = 'time_off' then
    if tg_op <> 'DELETE' and exists (
      select 1 from public.appointments a where a.organization_id = org_id and a.professional_id = barber_id
        and a.status in ('pending', 'confirmed', 'in_progress') and a.ends_at > now()
        and a.starts_at < new.ends_at and a.ends_at > new.starts_at
    ) then
      raise exception using errcode = 'BF030', message = 'schedule change conflicts with appointment';
    end if;
  else
    select timezone into zone from public.organizations where id = org_id;
    if exists (
      select 1 from public.appointments a
      cross join lateral (select a.starts_at at time zone zone as lo, a.ends_at at time zone zone as hi) l
      where a.organization_id = org_id and a.professional_id = barber_id
        and a.status in ('pending', 'confirmed', 'in_progress') and a.ends_at > now()
        and (
          (tg_op <> 'INSERT' and old.weekday = extract(dow from l.lo)
            and old.starts_at <= l.lo::time and old.ends_at >= l.hi::time
            and (tg_op = 'DELETE' or new.weekday <> old.weekday
              or new.starts_at > l.lo::time or new.ends_at < l.hi::time))
          or (tg_op <> 'DELETE' and new.weekday = extract(dow from l.lo)
            and new.break_starts_at < l.hi::time and new.break_ends_at > l.lo::time)
        )
    ) then
      raise exception using errcode = 'BF030', message = 'schedule change conflicts with appointment';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_working_hours before insert or update or delete on public.working_hours
  for each row execute function barberflow_private.guard_schedule_change();
create trigger guard_time_off before insert or update or delete on public.time_off
  for each row execute function barberflow_private.guard_schedule_change();
revoke execute on function barberflow_private.guard_schedule_change() from public, anon, authenticated, service_role;

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
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 912871));
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
