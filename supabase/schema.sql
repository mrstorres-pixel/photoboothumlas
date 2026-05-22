create extension if not exists "pgcrypto";

create table if not exists public.owners (
  id text primary key,
  business_name text not null,
  support_email text,
  paymongo_secret_env text not null default 'PAYMONGO_SECRET_KEY',
  platform_fee_basis_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booths (
  id text primary key,
  owner_id text not null references public.owners(id) on delete cascade,
  location_name text not null,
  display_name text not null,
  activation_code text unique not null,
  status text not null default 'active',
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id text primary key,
  name text not null,
  description text not null,
  price integer not null check (price >= 100),
  shots integer not null check (shots > 0),
  prints integer not null check (prints >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booth_packages (
  booth_id text not null references public.booths(id) on delete cascade,
  package_id text not null references public.packages(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (booth_id, package_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.owners(id),
  booth_id text not null references public.booths(id),
  package_id text not null references public.packages(id),
  package_name text not null,
  package_description text not null,
  amount integer not null check (amount >= 100),
  shots integer not null,
  prints integer not null,
  status text not null default 'created',
  payment_status text not null default 'created',
  payment_intent_id text,
  payment_method_id text,
  payment_id text,
  qr_image text,
  test_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_owner_id_idx on public.orders(owner_id);
create index if not exists orders_booth_id_idx on public.orders(booth_id);
create index if not exists orders_payment_intent_id_idx on public.orders(payment_intent_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

alter table public.owners enable row level security;
alter table public.booths enable row level security;
alter table public.packages enable row level security;
alter table public.booth_packages enable row level security;
alter table public.orders enable row level security;

insert into public.owners (
  id,
  business_name,
  support_email,
  paymongo_secret_env,
  platform_fee_basis_points
) values (
  'owner-demo',
  'Umlas Photo Co.',
  'support@example.com',
  'PAYMONGO_SECRET_KEY',
  0
) on conflict (id) do update set
  business_name = excluded.business_name,
  support_email = excluded.support_email,
  paymongo_secret_env = excluded.paymongo_secret_env,
  platform_fee_basis_points = excluded.platform_fee_basis_points,
  updated_at = now();

insert into public.booths (
  id,
  owner_id,
  location_name,
  display_name,
  activation_code,
  status,
  theme
) values (
  'booth-demo-001',
  'owner-demo',
  'Demo Studio',
  'Umlas Photobooth',
  'UMLAS-DEMO-001',
  'active',
  '{"accent":"#0f766e","logoText":"Umlas Photobooth"}'::jsonb
) on conflict (id) do update set
  owner_id = excluded.owner_id,
  location_name = excluded.location_name,
  display_name = excluded.display_name,
  activation_code = excluded.activation_code,
  status = excluded.status,
  theme = excluded.theme,
  updated_at = now();

insert into public.packages (
  id,
  name,
  description,
  price,
  shots,
  prints
) values
  ('classic', 'Classic Strip', '4 poses, 2 printed strips', 15000, 4, 2),
  ('party', 'Party Set', '6 poses, 4 printed strips', 25000, 6, 4),
  ('premium', 'Premium Keepsake', '8 poses, 6 printed strips', 35000, 8, 6)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  shots = excluded.shots,
  prints = excluded.prints,
  updated_at = now();

insert into public.booth_packages (booth_id, package_id, sort_order) values
  ('booth-demo-001', 'classic', 10),
  ('booth-demo-001', 'party', 20),
  ('booth-demo-001', 'premium', 30)
on conflict (booth_id, package_id) do update set
  sort_order = excluded.sort_order;
