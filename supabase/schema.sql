-- Supabase Schema for Racquet Sports Club Manager

-- Enable UUID extension globally if not enabled
create extension if not exists "pgcrypto";

-- Profiles table linked to Supabase Auth
create table public.profiles (
  id uuid references auth.users not null,
  first_name text,
  last_name text,
  avatar_url text,
  primary key (id)
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Clubs table
create table public.clubs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.clubs enable row level security;
create policy "Clubs are viewable by everyone." on clubs for select using (true);

-- Ladders table
create table public.ladders (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs not null,
  name text not null,
  sport text not null,
  rules text
);
alter table public.ladders enable row level security;
create policy "Ladders are viewable by everyone." on ladders for select using (true);

-- Ladder Players tracking rank
create table public.ladder_players (
  id uuid default gen_random_uuid() primary key,
  ladder_id uuid references public.ladders not null,
  player_id uuid references public.profiles not null,
  current_rank integer not null,
  wins integer default 0,
  losses integer default 0,
  unique(ladder_id, player_id)
);
alter table public.ladder_players enable row level security;
create policy "Ranks are viewable by everyone." on ladder_players for select using (true);

-- Matches tracking result
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  ladder_id uuid references public.ladders not null,
  challenger_id uuid references public.profiles not null,
  defender_id uuid references public.profiles not null,
  status text default 'pending', -- pending, completed, disputed
  winner_id uuid references public.profiles,
  score_text text,
  played_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.matches enable row level security;
create policy "Matches are viewable by everyone." on matches for select using (true);
create policy "Players can create matches" on matches for insert with check (auth.uid() = challenger_id or auth.uid() = defender_id);
