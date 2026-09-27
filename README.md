# Gomoku — Online 2-Player Multiplayer

A minimal, real-time, 2-player Gomoku (five-in-a-row) web app. No accounts,
no login — enter a name, create or join a room, share the link, play.

## Project

Two players play Gomoku on a 15×15 board from any two devices/browsers.
Player 1 creates a room and gets a shareable link; Player 2 opens the link
and joins. Moves sync instantly over Supabase Realtime. A third visitor to
a full room is turned away. After a win or draw, both players can choose
"Play Again" to reset the same room without re-sharing a link or re-entering
names.

## Features

- 2-player online Gomoku (15×15 board, 5-in-a-row to win, draw detection)
- Shareable room links (`/game/ROOMCODE`) — no accounts or passwords
- Real-time moves via Supabase Realtime (Postgres change events)
- Server-side move validation (turn order, occupied cells, win/draw) via
  Postgres functions — the client cannot fake a move
- "Room full" handling for a third visitor
- Play Again / rematch flow that reuses the same room and colors
- Basic disconnect / reconnect handling via Presence
- Two complete visual themes (Midnight / Porcelain), switchable instantly
  with no game-state loss
- Responsive layout for desktop and mobile

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS (layout) + custom CSS theme variables
- **Realtime & state:** Supabase (Postgres + Realtime + RPC functions)
- **Routing:** React Router
- **Hosting:** Vercel

## How Multiplayer Works

There is no custom WebSocket server. Instead:

1. Game state (board, whose turn, status, winner) lives in a single row per
   room in a Postgres `rooms` table.
2. All writes (create room, join, make a move, request rematch) go through
   Postgres **RPC functions** (`create_room`, `join_room`, `make_move`,
   `play_again`), never direct table writes. These functions run with
   elevated privileges and are the only way to mutate a room, so they
   centralize every validation rule (does the room exist, is it this
   player's turn, is the cell empty, has the game already ended, etc.).
   A tampered client can call these functions but cannot bypass their
   checks.
3. Both browsers subscribe to Postgres change events for their room's row
   via a Supabase Realtime channel, so any accepted move is pushed to both
   players immediately — no polling, no page refresh.
4. A lightweight Supabase Presence channel per room tells each browser
   whether the opponent's tab is currently open, to show "opponent
   disconnected" / "waiting for opponent" states.

## Installation

```bash
npm install
npm run dev
```

This starts a local dev server (default: http://localhost:5173).

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase project's values:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

You'll find both under **Supabase Dashboard → Project Settings → API**.
The anon key is safe to expose in a frontend app — access control is
enforced by Row Level Security and the RPC functions (see below), not by
keeping the key secret.

## Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it.
   This single script creates:
   - the `rooms` table
   - Row Level Security (public read only; all writes go through functions)
   - the `create_room`, `join_room`, `make_move`, `play_again` functions
   - grants so the anon key can call them
   - adds `rooms` to the `supabase_realtime` publication so changes stream
     live
3. Confirm Realtime is enabled for your project (it is by default) under
   **Database → Replication**. You should see `rooms` listed under the
   `supabase_realtime` publication after running the script.
4. Copy your Project URL and anon public key into `.env` as described above.

No auth setup, no extra tables, and no manual RLS policy editing beyond
running the script.

## Local Testing (multiplayer, on one machine)

1. `npm run dev`
2. Open the app in a normal browser window, click **Create Game**, enter a
   name, and copy the generated room link.
3. Open that link in an **Incognito/Private window** (or a second browser),
   enter a different name, and click **Join Game**.
4. Play moves in one window and confirm they appear instantly in the other.
5. Try opening the same room link in a third window — it should show
   **GAME FULL**.
6. Close one window mid-game and confirm the other shows
   **Opponent disconnected**; reopen the same link to reconnect to your slot.
7. Finish a game (or resign by filling the board) and test **Play Again**
   from both sides.
8. Toggle between the Midnight and Porcelain themes mid-game and confirm
   nothing resets.

## Production Deployment (Vercel)

1. Push this project to a GitHub/GitLab/Bitbucket repository.
2. In [Vercel](https://vercel.com), click **Add New → Project** and import
   the repository (Framework Preset: **Vite** is auto-detected).
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Vercel will run `npm install` and `npm run build` automatically.
5. `vercel.json` is included so client-side routes like `/game/AB12CD` work
   correctly on refresh/direct link (it rewrites all paths to `index.html`).
6. Once deployed, open the Vercel URL, create a game, and share the link —
   test from two different devices/networks the same way as in local
   testing above.

## Project Structure

```
gomoku/
├── src/
│   ├── components/     # Board, Cell, PlayerPanel, GameStatus, ThemeSwitcher, Toast
│   ├── pages/           # Home, Game
│   ├── lib/              # supabase client, api (RPC calls), room codes, gameLogic
│   ├── hooks/           # useGame (realtime + presence + actions), useTheme
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css        # Tailwind + both themes (CSS variables) + board styling
├── supabase/
│   └── schema.sql       # table, RLS, RPC functions, grants, realtime publication
├── .env.example
├── vercel.json
└── package.json
```

## Notes on Scope

This is intentionally a small project: no accounts, no matchmaking, no
chat, no spectators, no rankings, and no persistent room history beyond
what's needed to play. Rooms are cheap Postgres rows; see the bottom of
`supabase/schema.sql` for an optional cleanup query if you want to prune
old rooms periodically.
