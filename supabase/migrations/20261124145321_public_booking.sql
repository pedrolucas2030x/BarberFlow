create table barberflow_private.booking_rate (
  slug text not null, bucket timestamptz not null, operation text not null, origin text not null,
  hits integer not null, primary key (slug,bucket,operation,origin)
);
create index booking_rate_bucket_idx on barberflow_private.booking_rate(bucket);
create table barberflow_private.booking_attempts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt uuid not null, fingerprint bytea not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key (organization_id,attempt)
);
create index booking_attempts_created_idx on barberflow_private.booking_attempts(created_at);

create function barberflow_private.public_catalog(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name',o.name,'timezone',o.timezone,
    'offers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'service',s.id, 'name',s.name, 'description',s.description, 'minutes',s.duration_minutes,
        'price',s.price_cents, 'professional',p.id, 'professionalName',p.name, 'specialties',p.specialties
      ) order by s.name,p.name,p.id)
      from (select l.* from public.professional_services l where l.organization_id=o.id
        order by l.professional_id,l.service_id limit 500) l
      join public.services s on (s.organization_id,s.id)=(l.organization_id,l.service_id) and s.active
      join public.professionals p on (p.organization_id,p.id)=(l.organization_id,l.professional_id) and p.active
    ),'[]'::jsonb))
  from public.organizations o where o.slug=p_slug and o.status='active';
$$;

create function barberflow_private.public_booking(
  p_slug text, p_origin text, p_service uuid, p_professional uuid,
  p_day date, p_start timestamptz, p_name text, p_phone text, p_attempt uuid,
  p_price integer, p_minutes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  shop public.organizations%rowtype;
  offer public.services%rowtype;
  barber public.professionals%rowtype;
  cached barberflow_private.booking_attempts%rowtype;
  customer uuid;
  booking uuid;
  finish timestamptz;
  fingerprint bytea;
  result jsonb;
  mode text := case when p_attempt is not null then 'reserve' else 'slots' end;
  bucket_time timestamptz := date_trunc('minute',now());
  hits_so_far integer;
  local_start timestamp;
  local_today date;
  can_book boolean;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,63}$' or p_origin is null or p_origin !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error','invalid');
  end if;
  select * into shop from public.organizations where slug=p_slug and status='active';
  if not found then return jsonb_build_object('error','not_found'); end if;

  insert into barberflow_private.booking_rate as r values(p_slug,bucket_time,mode,'*',1)
    on conflict (slug,bucket,operation,origin) do update set hits=least(r.hits+1,301) returning hits into hits_so_far;
  if hits_so_far > (case when mode='reserve' then 40 else 300 end) then return jsonb_build_object('error','rate'); end if;
  insert into barberflow_private.booking_rate as r values(p_slug,bucket_time,mode,p_origin,1)
    on conflict (slug,bucket,operation,origin) do update set hits=least(r.hits+1,61) returning hits into hits_so_far;
  if hits_so_far > (case when mode='reserve' then 6 else 60 end) then return jsonb_build_object('error','rate'); end if;
  delete from barberflow_private.booking_rate where bucket < now() - interval '1 day';
  local_today := (now() at time zone shop.timezone)::date;
  if not isfinite(p_day) or p_day is null or p_day < local_today or p_day >= local_today + 60 then
    return jsonb_build_object('error','invalid');
  end if;

  if mode='reserve' then
    if p_start is null or not isfinite(p_start) or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
      or p_name is null or btrim(p_name) !~ '^[^[:cntrl:]]{2,100}$' then
      return jsonb_build_object('error','invalid');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(shop.id::text,912871));
    select * into shop from public.organizations where slug=p_slug and status='active' for share;
    if not found then return jsonb_build_object('error','not_found'); end if;
    fingerprint := sha256(convert_to(jsonb_build_array(p_service,p_professional,p_start,btrim(p_name),p_phone,p_price,p_minutes)::text,'UTF8'));
    select * into cached from barberflow_private.booking_attempts where organization_id=shop.id and attempt=p_attempt;
    if found then
      if cached.fingerprint <> fingerprint then return jsonb_build_object('error','attempt'); end if;
      return cached.result;
    end if;
  end if;

  select p.* into barber from public.professionals p
    where p.organization_id=shop.id and p.id=p_professional and p.active for share;
  if not found then return jsonb_build_object('error','not_found'); end if;
  select s.* into offer from public.professional_services l
    join public.services s on (s.organization_id,s.id)=(l.organization_id,l.service_id)
    where l.organization_id=shop.id and l.professional_id=barber.id and s.id=p_service and s.active for share of l,s;
  if not found then return jsonb_build_object('error','not_found'); end if;

  if mode='slots' then
    return jsonb_build_object('slots',coalesce((
      select jsonb_agg(slot order by slot)
      from generate_series(p_day::timestamp at time zone shop.timezone,
        ((p_day+1)::timestamp at time zone shop.timezone)-interval '1 minute', interval '15 minutes') slot
      where (slot at time zone shop.timezone)::date=p_day
        and extract(minute from slot at time zone shop.timezone)::int % 15=0
        and barberflow_private.slot_fits(shop.id,barber.id,slot,slot+make_interval(mins=>offer.duration_minutes),shop.timezone,true)
    ),'[]'::jsonb));
  end if;

  if offer.price_cents is distinct from p_price or offer.duration_minutes is distinct from p_minutes then
    return jsonb_build_object('error','offer');
  end if;
  local_start := p_start at time zone shop.timezone;
  finish := p_start+make_interval(mins=>offer.duration_minutes);
  can_book := local_start::date=p_day and extract(minute from local_start)::int % 15=0
    and extract(second from local_start)=0
    and barberflow_private.slot_fits(shop.id,barber.id,p_start,finish,shop.timezone,true);
  if not can_book then return jsonb_build_object('error','conflict'); end if;

  begin
    insert into public.customers(organization_id,name,phone) values(shop.id,btrim(p_name),p_phone)
      on conflict (organization_id,phone) do nothing returning id into customer;
    if not found then
      select id into customer from public.customers where organization_id=shop.id and phone=p_phone for key share;
    end if;
    if customer is null then return jsonb_build_object('error','unavailable'); end if;
    insert into public.appointments(organization_id,professional_id,service_id,customer_id,starts_at,ends_at,status,price_cents,commission_bps)
      values(shop.id,barber.id,offer.id,customer,p_start,finish,'confirmed',offer.price_cents,barber.commission_bps) returning id into booking;
    result := jsonb_build_object('status','confirmed','name',shop.name,'service',offer.name,
      'professional',barber.name,'start',p_start,'timezone',shop.timezone,'price',offer.price_cents);
    insert into barberflow_private.booking_attempts(organization_id,attempt,fingerprint,result)
      values(shop.id,p_attempt,fingerprint,result);
    delete from barberflow_private.booking_attempts where created_at < now() - interval '7 days';
    return result;
  exception when exclusion_violation then
    return jsonb_build_object('error','conflict');
  end;
end;
$$;

grant usage on schema barberflow_private to service_role;
create function public.public_catalog(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select barberflow_private.public_catalog(p_slug);
$$;
create function public.public_booking(
  p_slug text, p_origin text, p_service uuid, p_professional uuid, p_day date, p_start timestamptz,
  p_name text, p_phone text, p_attempt uuid, p_price integer, p_minutes integer
) returns jsonb language sql security invoker set search_path = '' as $$
  select barberflow_private.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
$$;
revoke execute on function public.public_catalog(text), barberflow_private.public_catalog(text),
  public.public_booking(text,text,uuid,uuid,date,timestamptz,text,text,uuid,integer,integer),
  barberflow_private.public_booking(text,text,uuid,uuid,date,timestamptz,text,text,uuid,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.public_catalog(text), barberflow_private.public_catalog(text),
  public.public_booking(text,text,uuid,uuid,date,timestamptz,text,text,uuid,integer,integer),
  barberflow_private.public_booking(text,text,uuid,uuid,date,timestamptz,text,text,uuid,integer,integer) to service_role;
