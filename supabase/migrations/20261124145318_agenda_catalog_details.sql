alter table public.services add column description text check (char_length(description) <= 280);
alter table public.professionals add column specialties text check (char_length(specialties) <= 160);
grant insert (description), update (description) on public.services to authenticated;
grant insert (specialties), update (specialties) on public.professionals to authenticated;
