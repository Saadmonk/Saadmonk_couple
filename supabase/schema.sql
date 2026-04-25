create extension if not exists pgcrypto;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) = 6),
  host_name text not null,
  guest_name text,
  game_key text not null default 'lobby',
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'playing', 'finished')),
  room_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_game_room()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists game_rooms_touch_updated_at on public.game_rooms;

create trigger game_rooms_touch_updated_at
before update on public.game_rooms
for each row
execute function public.touch_game_room();

alter table public.game_rooms enable row level security;

drop policy if exists "prototype room reads" on public.game_rooms;
create policy "prototype room reads"
on public.game_rooms
for select
to anon, authenticated
using (true);

drop policy if exists "prototype room inserts" on public.game_rooms;
create policy "prototype room inserts"
on public.game_rooms
for insert
to anon, authenticated
with check (true);

drop policy if exists "prototype room updates" on public.game_rooms;
create policy "prototype room updates"
on public.game_rooms
for update
to anon, authenticated
using (true)
with check (true);

comment on table public.game_rooms is
'Prototype room storage for Couples Club online play. Tighten RLS before public launch.';
