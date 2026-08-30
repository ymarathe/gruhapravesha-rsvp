create extension if not exists pgcrypto;

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  household_name text not null check (char_length(household_name) between 1 and 100),
  attendance_status text not null check (attendance_status in ('attending', 'declined')),
  ceremony_adults smallint not null default 0 check (ceremony_adults between 0 and 20),
  ceremony_children smallint not null default 0 check (ceremony_children between 0 and 20),
  breakfast_adults smallint not null default 0 check (breakfast_adults between 0 and 20),
  breakfast_children smallint not null default 0 check (breakfast_children between 0 and 20),
  lunch_adults smallint not null default 0 check (lunch_adults between 0 and 20),
  lunch_children smallint not null default 0 check (lunch_children between 0 and 20),
  email text,
  phone text,
  dietary_notes text check (char_length(dietary_notes) <= 500),
  message text check (char_length(message) <= 500),
  edit_token_hash text not null unique,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_required check (nullif(trim(email), '') is not null or nullif(trim(phone), '') is not null),
  constraint attending_has_guests check (
    (attendance_status = 'declined' and ceremony_adults = 0 and ceremony_children = 0 and breakfast_adults = 0 and breakfast_children = 0 and lunch_adults = 0 and lunch_children = 0)
    or
    (attendance_status = 'attending' and ceremony_adults + ceremony_children > 0)
  )
);

alter table public.rsvps enable row level security;
create index rsvps_attendance_idx on public.rsvps (attendance_status);
create index rsvps_submitted_at_idx on public.rsvps (submitted_at desc);

create table public.organizers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.organizers enable row level security;

-- No anonymous table policies are created. All guest and organizer access goes
-- through Edge Functions that perform their own validation and authorization.
