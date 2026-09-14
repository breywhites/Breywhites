-- =====================================================================
--  Breywhites — database schema (website + admin)
--  Run once in Supabase → SQL Editor → New query → paste → Run.
--  Safe to re-run: every object is created "if not exists" / replaced.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Who is an admin
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
--  Settings
-- ---------------------------------------------------------------------
-- shown on the public website
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  studio_name text not null default 'Breywhites',
  tagline text not null default 'Where your wedding becomes a timeless film.',
  whatsapp text not null default '918089141816',
  phones text[] not null default array['8089141816', '7012001816'],
  instagram text not null default 'breywhites',
  email text not null default 'Breywhites7@gmail.com',
  slideshow_seconds int not null default 3 check (slideshow_seconds between 2 and 10),
  updated_at timestamptz not null default now()
);

-- only visible inside admin (printed on quotes / invoices)
create table if not exists public.business_settings (
  id int primary key default 1 check (id = 1),
  advance_percent int not null default 30 check (advance_percent between 0 and 100),
  upi_id text,
  bank_details text,
  quote_terms text not null default 'Advance payment blocks the date; balance on the event day.',
  invoice_terms text not null default 'Thank you for choosing Breywhites.',
  price_link_days int not null default 14 check (price_link_days between 1 and 90),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Portfolio
-- ---------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  path_large text not null,            -- storage path, ~1600px
  path_thumb text not null,            -- storage path, ~600px
  width int,
  height int,
  category text not null default 'wedding'
    check (category in ('bride', 'groom', 'couple', 'wedding', 'details', 'pre-wedding', 'events')),
  title text,
  published boolean not null default true,   -- shows in the portfolio
  featured boolean not null default false,   -- shows in "Recent weddings" on the homepage
  in_slideshow boolean not null default false,
  slide_order int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists photos_published_idx on public.photos (published, sort, created_at desc);
create index if not exists photos_slides_idx on public.photos (in_slideshow, slide_order);

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_url text not null,             -- YouTube / Instagram / Drive link
  poster_path text,                    -- storage path
  duration_label text,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Calendar: free / booked / on-hold days
-- ---------------------------------------------------------------------
create table if not exists public.calendar_days (
  day date primary key,
  status text not null default 'free' check (status in ('free', 'booked', 'hold')),
  note text,
  invoice_id uuid,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Packages & enquiries
-- ---------------------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  kicker text,
  price int not null check (price >= 0),
  team text,
  team_sub text,
  items text[] not null default '{}',
  extra text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  event_date date,
  event_type text check (event_type is null or char_length(event_type) <= 60),
  message text check (message is null or char_length(message) <= 2000),
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'replied', 'quoted', 'booked', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Private price links (breywhites.com/p/<slug>)
-- ---------------------------------------------------------------------
create table if not exists public.price_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  client_name text not null,
  phone text,
  wedding_date date,
  package_ids uuid[] not null default '{}',
  valid_until date not null default (current_date + 14),
  status text not null default 'active' check (status in ('active', 'booked', 'archived')),
  enquiry_id uuid references public.enquiries (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.price_link_events (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.price_links (id) on delete cascade,
  kind text not null check (kind in ('open', 'view', 'book', 'ask')),
  package_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists price_link_events_link_idx on public.price_link_events (link_id, created_at desc);

-- ---------------------------------------------------------------------
--  Quotes, invoices, payments
-- ---------------------------------------------------------------------
create table if not exists public.doc_counters (
  kind text not null,
  year int not null,
  last int not null default 0,
  primary key (kind, year)
);

create or replace function public.next_doc_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now());
  n int;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_kind not in ('Q', 'INV') then
    raise exception 'unknown document kind %', p_kind;
  end if;
  insert into public.doc_counters (kind, year, last) values (p_kind, y, 1)
  on conflict (kind, year) do update set last = public.doc_counters.last + 1
  returning last into n;
  return p_kind || '-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_name text not null,
  phone text,
  event_date date,
  venue text,
  items jsonb not null default '[]',      -- [{package_id, name, description, price, qty}]
  discount int not null default 0 check (discount >= 0),
  advance_percent int not null default 30 check (advance_percent between 0 and 100),
  subtotal int not null default 0,
  total int not null default 0,
  terms text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'invoiced')),
  price_link_id uuid references public.price_links (id) on delete set null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  quote_id uuid references public.quotes (id) on delete set null,
  client_name text not null,
  phone text,
  event_date date,
  venue text,
  items jsonb not null default '[]',
  discount int not null default 0 check (discount >= 0),
  total int not null default 0 check (total >= 0),
  paid int not null default 0,
  status text not null default 'due' check (status in ('due', 'part_paid', 'paid', 'cancelled')),
  terms text,
  issued_on date not null default current_date,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount int not null check (amount > 0),
  method text not null default 'upi' check (method in ('upi', 'cash', 'bank', 'card', 'other')),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_idx on public.payments (invoice_id);

-- keep invoice.paid / status in step with payments, and block the date once money comes in
create or replace function public.sync_invoice_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  -- status and the booked date follow from "paid" (see the invoice triggers below)
  update public.invoices
     set paid = (select coalesce(sum(amount), 0) from public.payments where invoice_id = inv_id)
   where id = inv_id;
  return null;
end;
$$;

drop trigger if exists payments_sync on public.payments;
create trigger payments_sync
after insert or update or delete on public.payments
for each row execute function public.sync_invoice_payments();

-- Invoice status always matches the money received (unless cancelled).
create or replace function public.invoice_set_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'cancelled' then
    new.status := case
      when new.paid >= new.total and new.total > 0 then 'paid'
      when new.paid > 0 then 'part_paid'
      else 'due' end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_status on public.invoices;
create trigger invoices_status
before insert or update on public.invoices
for each row execute function public.invoice_set_status();

-- A date is booked while its invoice has money received and isn't cancelled.
-- Moving the date, removing the payment, cancelling or deleting frees it again.
create or replace function public.invoice_sync_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.calendar_days where invoice_id = old.id and status = 'booked';
    return null;
  end if;

  delete from public.calendar_days
   where invoice_id = new.id and status = 'booked'
     and (new.event_date is null or day <> new.event_date or new.status not in ('part_paid', 'paid'));

  if new.event_date is not null and new.status in ('part_paid', 'paid') then
    insert into public.calendar_days (day, status, invoice_id, note, updated_at)
    values (new.event_date, 'booked', new.id, new.client_name, now())
    on conflict (day) do update
      set status = 'booked', invoice_id = excluded.invoice_id, note = excluded.note, updated_at = now();
  end if;
  return null;
end;
$$;

drop trigger if exists invoices_booking on public.invoices;
create trigger invoices_booking
after insert or update or delete on public.invoices
for each row execute function public.invoice_sync_booking();

-- ---------------------------------------------------------------------
--  Public functions for the private price page
-- ---------------------------------------------------------------------
create or replace function public.get_price_link(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.price_links%rowtype;
begin
  select * into l from public.price_links where slug = lower(p_slug) and status <> 'archived';
  if l.id is null then
    return null;
  end if;
  return json_build_object(
    'slug', l.slug,
    'client_name', l.client_name,
    'wedding_date', l.wedding_date,
    'valid_until', l.valid_until,
    'expired', l.valid_until < current_date,
    'packages', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'short_name', p.short_name, 'kicker', p.kicker,
        'price', p.price, 'team', p.team, 'team_sub', p.team_sub,
        'items', p.items, 'extra', p.extra
      ) order by p.sort, p.price)
      from public.packages p
      where p.active and p.id = any (l.package_ids)
    ), '[]'::json)
  );
end;
$$;

create or replace function public.log_price_event(p_slug text, p_kind text, p_package uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  recent int;
begin
  if p_kind not in ('open', 'view', 'book', 'ask') then
    return;
  end if;
  select id into lid from public.price_links where slug = lower(p_slug) and status <> 'archived';
  if lid is null then
    return;
  end if;
  -- ignore floods from one page
  select count(*) into recent from public.price_link_events
   where link_id = lid and created_at > now() - interval '1 minute';
  if recent > 60 then
    return;
  end if;
  insert into public.price_link_events (link_id, kind, package_id) values (lid, p_kind, p_package);
end;
$$;

-- admin view: how each price link is doing
create or replace view public.price_link_stats
with (security_invoker = true)
as
select
  l.id,
  l.slug,
  l.client_name,
  l.phone,
  l.wedding_date,
  l.valid_until,
  l.status,
  l.package_ids,
  l.created_at,
  (select count(*) from public.price_link_events e where e.link_id = l.id and e.kind = 'open') as opens,
  (select max(e.created_at) from public.price_link_events e where e.link_id = l.id and e.kind = 'open') as last_opened_at,
  (select count(*) from public.price_link_events e where e.link_id = l.id and e.kind = 'book') as book_clicks,
  (select p.name from public.price_link_events e join public.packages p on p.id = e.package_id
    where e.link_id = l.id and e.kind in ('view', 'book')
    group by p.name order by count(*) desc limit 1) as top_package
from public.price_links l;

-- ---------------------------------------------------------------------
--  Row level security
-- ---------------------------------------------------------------------
alter table public.admins            enable row level security;
alter table public.site_settings     enable row level security;
alter table public.business_settings enable row level security;
alter table public.photos            enable row level security;
alter table public.films             enable row level security;
alter table public.calendar_days     enable row level security;
alter table public.packages          enable row level security;
alter table public.enquiries         enable row level security;
alter table public.price_links       enable row level security;
alter table public.price_link_events enable row level security;
alter table public.doc_counters      enable row level security;
alter table public.quotes            enable row level security;
alter table public.invoices          enable row level security;
alter table public.payments          enable row level security;

do $$
declare t text;
begin
  -- admins can do everything on every table
  foreach t in array array['site_settings', 'business_settings', 'photos', 'films', 'calendar_days', 'packages',
                           'enquiries', 'price_links', 'price_link_events', 'doc_counters', 'quotes', 'invoices', 'payments']
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

-- what the public website may read
drop policy if exists public_read on public.site_settings;
create policy public_read on public.site_settings for select to anon, authenticated using (true);

drop policy if exists public_read on public.photos;
create policy public_read on public.photos for select to anon, authenticated using (published or in_slideshow);

drop policy if exists public_read on public.films;
create policy public_read on public.films for select to anon, authenticated using (published);

drop policy if exists public_read on public.calendar_days;
create policy public_read on public.calendar_days for select to anon, authenticated
  using (status = 'free' and day >= current_date);

drop policy if exists public_read on public.packages;
create policy public_read on public.packages for select to anon, authenticated using (active);

-- visitors can send an enquiry, but never read them
drop policy if exists public_insert on public.enquiries;
create policy public_insert on public.enquiries for insert to anon, authenticated
  with check (status = 'new' and source = 'website');

-- Explicit permissions (new Supabase projects no longer add these automatically).
-- Row level security above decides which rows each person can actually touch.
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on public.site_settings, public.photos, public.films, public.calendar_days, public.packages to anon;
grant insert on public.enquiries to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.get_price_link(text) to anon, authenticated;
grant execute on function public.log_price_event(text, text, uuid) to anon, authenticated;
grant execute on function public.next_doc_number(text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
--  Photo storage (public bucket, only admins can change it)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos admin insert" on storage.objects;
create policy "photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos admin update" on storage.objects;
create policy "photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- ---------------------------------------------------------------------
--  Starting data
-- ---------------------------------------------------------------------
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
insert into public.business_settings (id) values (1) on conflict (id) do nothing;

insert into public.packages (name, short_name, kicker, price, team, team_sub, items, extra, sort)
select * from (values
  ('1 Day Package', '1 Day', 'One day · Photo + video', 29000, '2 cameramen', '1 videographer · 1 photographer',
     array['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], null, 1),
  ('1 Day Wedding', '1 Day Wedding', 'One day · Wedding', 32000, '2 professional cameramen', '1 videographer · 1 photographer',
     array['Unlimited photos', '2 videos', '1 reel · 30–45 sec', '1 highlight film · 2–3 min'], null, 2),
  ('Unique 2 Days Wedding', '2 Days', 'Two days · Wedding', 38000, '2 cameramen', '1 camera videographer · 1 mobile photographer',
     array['Unlimited mobile photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], 'Coverage across two days', 3),
  ('Classic Wedding', 'Classic', 'Wedding · Classic', 42000, '2 professional cameramen', '1 videographer · 1 photographer',
     array['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], 'Longer 3–5 min highlight film', 4),
  ('Premium Wedding', 'Premium', 'Wedding · Premium', 62000, '2 professional cameramen', '1 videographer · 1 photographer',
     array['Unlimited photos', '4 videos', 'Pre-wedding shoot · 2 hours', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], 'Includes a 2-hour pre-wedding shoot', 5)
) as v(name, short_name, kicker, price, team, team_sub, items, extra, sort)
where not exists (select 1 from public.packages);

-- Your 15 starter photos ship with the website (in /demo), so the homepage
-- is full from day one. Delete or replace them any time in Admin → Photos.
insert into public.photos (path_large, path_thumb, width, height, category, title, published, featured, in_slideshow, slide_order, sort)
select 'demo/' || k || '-l.webp', 'demo/' || k || '-t.webp', w, h, cat, title, true, featured, slide >= 0, greatest(slide, 0), sort
from (values
  ('hero', 825, 1100, 'bride', 'Bride portrait', false, 0, 0),
  ('wedding1', 825, 1100, 'wedding', 'The exchange', true, -1, 1),
  ('event1', 825, 1100, 'wedding', 'Bridal party', false, -1, 2),
  ('portrait1', 825, 1100, 'bride', 'Veiled', true, -1, 3),
  ('detail1', 658, 780, 'details', 'Details', true, -1, 4),
  ('portrait2', 585, 780, 'bride', 'Garden portrait', false, 4, 5),
  ('bride1', 825, 1100, 'bride', 'Quiet moment', true, -1, 6),
  ('groom2', 825, 1100, 'groom', 'Arrival', true, -1, 7),
  ('bride2', 825, 1100, 'bride', 'Reflection', false, 2, 8),
  ('portrait3', 825, 1100, 'bride', 'Golden hour', true, -1, 9),
  ('groom1', 825, 1100, 'groom', 'Departure', false, -1, 10),
  ('couple1', 825, 1100, 'couple', 'First look', true, 1, 11),
  ('couple2', 825, 1100, 'couple', 'Together', false, 3, 12),
  ('film1', 825, 1100, 'events', 'Reception', false, -1, 13),
  ('couple3', 825, 1100, 'couple', 'The staircase', true, -1, 14)
) as v(k, w, h, cat, title, featured, slide, sort)
where not exists (select 1 from public.photos);

insert into public.films (title, video_url, poster_path, duration_label)
select 'Watch a wedding', 'https://instagram.com/breywhites', 'demo/film1-l.webp', 'Highlight film · 3–5 min'
where not exists (select 1 from public.films);

-- =====================================================================
--  LAST STEP (once): make yourself the admin.
--  1. Supabase → Authentication → Users → Add user → your email + a strong password
--  2. Run this line with your email:
--
--     insert into public.admins (user_id)
--     select id from auth.users where email = 'Breywhites7@gmail.com'
--     on conflict do nothing;
-- =====================================================================
