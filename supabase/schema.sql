-- Supabase Schema for Racquet Sports Club Manager

-- Enable UUID extension globally if not enabled
create extension if not exists "pgcrypto";

-- Profiles table linked to Supabase Auth
create table public.profiles (
  id uuid references auth.users not null,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  elo_rating integer default 800,   -- Singles ELO only
  doubles_elo integer default 800,  -- Doubles ELO only (updated by doubles matches)
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
  owner_id uuid references public.profiles(id),
  sports text[] default array['Badminton', 'Tennis']::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.clubs enable row level security;
create policy "Clubs are viewable by everyone." on clubs for select using (true);
create policy "Users can insert their own clubs." on clubs for insert with check (auth.uid() = owner_id);
create policy "Users can update their own clubs." on clubs for update using (auth.uid() = owner_id);

-- Club members table
create table public.club_members (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs not null,
  player_id uuid references public.profiles not null,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(club_id, player_id)
);
alter table public.club_members enable row level security;
create policy "Club members are viewable by everyone." on club_members for select using (true);
create policy "Club admins can insert members." on club_members for insert with check (
  exists (select 1 from public.club_members cm where cm.club_id = club_id and cm.player_id = auth.uid() and cm.role = 'admin')
  or
  player_id = auth.uid()
);
create policy "Club admins can delete members." on club_members for delete using (
  exists (select 1 from public.club_members cm where cm.club_id = club_id and cm.player_id = auth.uid() and cm.role = 'admin')
  or
  player_id = auth.uid()
);

-- Trigger to automatically add the club creator as an admin
create or replace function public.handle_new_club()
returns trigger as $$
begin
  insert into public.club_members (club_id, player_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_club_created
  after insert on public.clubs
  for each row execute procedure public.handle_new_club();

-- Club join requests
create table if not exists public.club_join_requests (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs not null,
  player_id uuid references public.profiles not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(club_id, player_id)
);
alter table public.club_join_requests enable row level security;
create policy "Admins and requesters can view join requests." on public.club_join_requests for select using (
  auth.uid() = player_id or
  exists (select 1 from public.club_members cm where cm.club_id = club_join_requests.club_id and cm.player_id = auth.uid() and cm.role = 'admin')
);
create policy "Users can request to join clubs." on public.club_join_requests for insert with check (auth.uid() = player_id);
create policy "Club admins can update join requests." on public.club_join_requests for update using (
  exists (select 1 from public.club_members cm where cm.club_id = club_join_requests.club_id and cm.player_id = auth.uid() and cm.role = 'admin')
);

-- Teams table
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs not null,
  name text,
  player1_id uuid references public.profiles not null,
  player2_id uuid references public.profiles not null,
  elo_rating integer default 800,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.teams enable row level security;
create policy "Teams are viewable by everyone." on teams for select using (true);
create policy "Users can form teams." on teams for insert with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- Ladders table
create table public.ladders (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs not null,
  name text not null,
  sport text not null,
  type text default 'singles' check (type in ('singles', 'doubles')),
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

-- Ladder Teams tracking rank (for doubles)
create table public.ladder_teams (
  id uuid default gen_random_uuid() primary key,
  ladder_id uuid references public.ladders not null,
  team_id uuid references public.teams not null,
  current_rank integer not null,
  wins integer default 0,
  losses integer default 0,
  unique(ladder_id, team_id)
);
alter table public.ladder_teams enable row level security;
create policy "Team Ranks are viewable by everyone." on ladder_teams for select using (true);

-- Matches tracking result
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  ladder_id uuid references public.ladders not null,
  challenger_id uuid references public.profiles,
  defender_id uuid references public.profiles,
  challenger_team_id uuid references public.teams,
  defender_team_id uuid references public.teams,
  status text default 'pending', -- pending, completed, disputed
  winner_id uuid references public.profiles,
  winner_team_id uuid references public.teams,
  score_text text,
  played_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.matches enable row level security;
create policy "Matches are viewable by everyone." on matches for select using (true);
create policy "Participants can create matches" on matches for insert with check (
  auth.uid() = challenger_id or auth.uid() = defender_id or 
  challenger_team_id is not null or defender_team_id is not null
);

-- Ensure correct privileges for all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- ELO Rating update trigger
create or replace function public.update_match_elo()
returns trigger as $$
declare
  win_elo int;
  lose_elo int;
  expected_win numeric;
  expected_lose numeric;
  new_win_elo int;
  new_lose_elo int;
  k_factor int := 32;
  loser_id uuid;
  is_singles boolean;
begin
  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    
    if new.challenger_team_id is not null then
      is_singles := false;
      loser_id := case when new.winner_team_id = new.challenger_team_id then new.defender_team_id else new.challenger_team_id end;
      
      select elo_rating into win_elo from public.teams where id = new.winner_team_id;
      select elo_rating into lose_elo from public.teams where id = loser_id;
    else
      is_singles := true;
      loser_id := case when new.winner_id = new.challenger_id then new.defender_id else new.challenger_id end;
      
      select elo_rating into win_elo from public.profiles where id = new.winner_id;
      select elo_rating into lose_elo from public.profiles where id = loser_id;
    end if;

    win_elo := coalesce(win_elo, 800);
    lose_elo := coalesce(lose_elo, 800);

    expected_win := 1.0 / (1.0 + power(10.0, (lose_elo - win_elo) / 400.0));
    expected_lose := 1.0 / (1.0 + power(10.0, (win_elo - lose_elo) / 400.0));

    new_win_elo := win_elo + round(k_factor * (1.0 - expected_win));
    new_lose_elo := lose_elo + round(k_factor * (0.0 - expected_lose));

    if is_singles then
      update public.profiles set elo_rating = new_win_elo where id = new.winner_id;
      update public.profiles set elo_rating = new_lose_elo where id = loser_id;
    else
      update public.teams set elo_rating = new_win_elo where id = new.winner_team_id;
      update public.teams set elo_rating = new_lose_elo where id = loser_id;
    end if;

  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_match_completed
  after update of status on public.matches
  for each row execute procedure public.update_match_elo();
