# Racquet Sports Club & Ladder App — Specification

## 1. Overview
A web application for managing racquet sports clubs (badminton, tennis, table tennis, squash, pickleball, padel) and competitive ladders. The app handles user authentication, club membership, singles & doubles ladder standings, match challenge workflows, ELO-based rankings, and score recording with confirmation.

## 2. Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite |
| Routing | React Router v6 |
| Styling | Vanilla CSS with design tokens, frosted-glass cards, watercolor background |
| Icons | Lucide React |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Google OAuth via Supabase Auth |
| Hosting | Local dev (`npm run dev`) on Vite |

## 3. User Roles
- **Player (Member):** Browse clubs, request to join, form doubles teams, participate in singles & doubles ladders, challenge opponents, record & confirm match scores, view match history.
- **Club Admin:** Create clubs, approve/reject join requests, create ladders within clubs, manage member roster.

## 4. Data Model (Supabase Schema)

### Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profile linked to `auth.users`. Contains `first_name`, `last_name`, `nickname`, `avatar_url`, `elo_rating` (singles), `doubles_elo`. |
| `clubs` | Club entity with `name`, `description`, `owner_id`, `sports[]`. |
| `club_members` | Join table: `club_id × player_id` with `role` (admin / member). |
| `club_join_requests` | Membership requests with `status` (pending / approved / rejected). |
| `teams` | Doubles teams: `player1_id`, `player2_id`, `name`, `club_id`, `elo_rating`. |
| `ladders` | Ladder within a club: `name`, `sport`, `type` (singles / doubles), `rules`. |
| `ladder_players` | Singles ladder entries: `ladder_id × player_id`, `current_rank`, `elo_rating`, `wins`, `losses`. Rank-0 rows are ELO placeholders for doubles ladder members. |
| `ladder_teams` | Doubles ladder entries: `ladder_id × team_id`, `current_rank`, `elo_rating`, `wins`, `losses`. |
| `matches` | Match records: challenger/defender (player or team IDs), `status`, `winner_id`/`winner_team_id`, `score_text`, `score_submitted_by`, `score_submitted_at`, `played_at`. |

### Key Triggers & Functions
- **`handle_new_club()`** — Automatically adds the club creator as an admin member.
- **`handle_new_user()`** — Creates a profile row when a new auth user is created.
- **`update_match_elo()`** — Fires on match status change to `completed`:
  - Calculates ELO using standard formula (K=32).
  - Updates `profiles.elo_rating` for singles or `teams.elo_rating` + `ladder_teams.elo_rating` for doubles.
  - Recomputes `current_rank` for all participants in the affected ladder based on ELO descending order.

### RLS Policies
- Profiles, clubs, ladders, ladder entries, matches, and teams are **readable by everyone** (authenticated).
- Write operations are restricted by ownership or admin role as appropriate.

## 5. Ranking System

### ELO-Based Rankings
- All standings are **ranked by ELO rating** (descending), not by join order.
- Display rank is computed client-side by sorting entries by `elo_rating DESC` and assigning sequential position numbers.
- The database trigger also recomputes stored `current_rank` after each match to keep it consistent.
- Default starting ELO: **800**.

### Challenge Rules
- Players/teams can challenge opponents up to **3 positions above or below** their current rank.
- A challenge button appears next to eligible opponents in the standings.
- Active challenges are tracked — users cannot challenge someone they already have an open match with.

## 6. Match Workflow

```
Challenge → Accept/Decline → Play → Record Score → Confirm/Dispute → Completed
```

1. **Challenge:** Player/team sends a challenge from the ladder standings page.
2. **Accept/Decline:** Defender accepts or declines via the Dashboard "Action Required" widget.
3. **Record Score:** Either participant records the result (winner + score text like "21-15, 21-18").
4. **Confirm/Dispute:** Opponent confirms or disputes the recorded score.
5. **Auto-Accept:** Scores not responded to within **24 hours** are automatically accepted (checked on Dashboard load).
6. **Complete:** On completion, the ELO trigger fires, updates ratings, and recomputes ladder ranks.
7. **Abandon:** Matches can be abandoned (no ELO change).

### Match Statuses
`pending` → `accepted` → `score_submitted` → `completed` | `disputed` | `declined` | `abandoned`

## 7. Application Screens

### 7.1 Login (`/login`)
- Google OAuth sign-in button.
- Redirects to Dashboard on success.

### 7.2 Dashboard (`/`)
- **Welcome header** with user avatar, name, and logout button.
- **Action Required widget** (red badge count) showing:
  - Incoming match challenges (accept/decline)
  - In-progress matches needing score recording
  - Score submissions needing confirmation
  - Club join requests (admin only)
- **Record Score modal** — select winner, enter score text, submit or abandon.
- **My Clubs card** — list of clubs with role badges, link to each club.
- **My Ranks card** — current rank + W/L in each joined ladder.

### 7.3 My Clubs (`/clubs`)
- Grid of club cards with name, description, role badge, and "View Club" link.
- **Create Club** inline form (name + description).
- **Browse & Join Clubs** link to `/clubs/join`.

### 7.4 Join Club (`/clubs/join`)
- Lists all public clubs.
- "Request to Join" sends a `club_join_requests` entry.

### 7.5 Club View (`/clubs/:id`)
- Club info header (name, description, sports).
- **Ladders section** — list of singles/doubles ladders with sport icons and type badge.
- **Create Ladder** form (admin only): name, sport dropdown, type toggle, optional rules.
- **Members section** — list of club members with role badges.

### 7.6 Ladder View (`/clubs/:id/ladders/:ladderId`)
- **Back to Club** link.
- **Ladder header** — name, sport icon, type badge (singles/doubles), optional rules.
- **Status card** (mobile-first top row):
  - Current rank badge (`✅ Rank #N`).
  - Team selector dropdown (doubles with multiple teams).
- **Join widget** (doubles):
  - Select dropdown of available teams + "＋ Form a new team…" option inside the dropdown.
  - Inline team creation form (team name + partner from club members).
- **Standings list** — sorted by ELO descending:
  - Medal icons for top 3 (🥇🥈🥉).
  - Player/team name, W/L record, ELO rating.
  - Per-player ELO shown for doubles teams.
  - Challenge button (±3 rank range).
- **Challenge confirmation modal** — select team (if multiple), confirm/cancel.

### 7.7 Ladders Overview (`/ladders`)
- **Two-pane layout:**
  - **Left pane** — scrollable list of all ladders the user has joined (both singles & doubles). Each item shows ladder name, club name, sport, type badge, rank, and W/L. Doubles ladders have an inline team selector dropdown.
  - **Right pane** — full standings for the selected ladder with challenge buttons.
- Challenge confirmation modal.

### 7.8 Match History (`/matches`)
- Chronological list of all matches (all statuses).
- Each row: participants, ladder, club, date, score, status badge.
- Inline actions: "Record Score" (accepted), "Confirm/Dispute" (score_submitted).
- Record Score modal.

### 7.9 Profile (`/profile`)
- Avatar, name, email display.
- Editable fields: first name, last name, nickname (public display name), avatar URL.
- Save button.

## 8. Navigation & Layout

### Desktop (>768px)
- **Sidebar** (250px fixed): frosted-glass navigation with links to Dashboard, My Clubs, Ladders, Matches, Profile. Active link highlighted. Brand "🏸 RacquetClub" at top links to home.

### Mobile (≤768px)
- **Sticky header** at top: bold "🏸 RacquetClub" (links to home) + hamburger menu button.
- **Hamburger menu** toggles a slide-down overlay with the same nav links. Clicking a link or the overlay backdrop closes it.
- Sidebar is hidden on mobile.

## 9. Visual Design

### Design System
- **Font:** Lexend / Inter / system-ui
- **Colors:** Dark navy primary (`#1a2b3d`), green accent (`#22c55e`), light slate BG (`#f8fafc`).
- **Cards:** Frosted-glass (`backdrop-filter: blur(8px)`, semi-transparent white BG), soft shadow, rounded corners (`1rem`).
- **Background:** Watercolor badminton illustration (`badminton_bg.png`) with `background-attachment: fixed` and a semi-transparent overlay (`rgba(248, 250, 252, 0.82)`).
- **Sidebar:** Frosted-glass (`blur(12px)`, nearly opaque white).
- **Badges:** Rounded pills with sport/status-specific color coding.
- **Interactions:** Hover shadows on cards, `translateY(-1px)` on primary buttons, smooth transitions.
