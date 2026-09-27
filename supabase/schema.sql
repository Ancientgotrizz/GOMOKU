-- ============================================================================
-- Gomoku multiplayer — Supabase schema
--
-- Run this whole file once in the Supabase SQL Editor (Project -> SQL Editor
-- -> New query -> paste -> Run). It creates:
--   1. The `rooms` table (one row per game room)
--   2. Row Level Security so the anon key can only READ rooms directly
--   3. Postgres functions (RPC) that perform every WRITE, so turn order,
--      occupied cells, and win detection are validated on the server and
--      cannot be bypassed by a modified client
--   4. Realtime publication so both players get live updates
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------

create table if not exists rooms (
  id text primary key,                         -- room code, e.g. AB12CD
  player1_id uuid,
  player1_name text,
  player2_id uuid,
  player2_name text,
  board jsonb not null,                         -- 15x15 array of null | "B" | "W"
  current_turn text not null default 'B',       -- 'B' | 'W'
  status text not null default 'waiting',       -- 'waiting' | 'playing' | 'finished'
  winner text,                                  -- 'B' | 'W' | 'draw' | null
  winning_line jsonb,                           -- [[row,col], ...] (5 cells) | null
  last_move jsonb,                              -- [row, col] | null
  player1_rematch boolean not null default false,
  player2_rematch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Row Level Security
--
-- Anyone who knows a room code can read that room's state (this is what lets
-- the browser subscribe to realtime changes and lets a returning player check
-- whether they already belong to the room). Nobody can write to the table
-- directly — every mutation must go through a SECURITY DEFINER function
-- below, which enforces the game rules.
-- ----------------------------------------------------------------------------

alter table rooms enable row level security;

drop policy if exists "public read" on rooms;
create policy "public read" on rooms for select using (true);

-- (No insert/update/delete policies are created, so direct writes from the
-- anon/authenticated roles are rejected by RLS.)

-- ----------------------------------------------------------------------------
-- 3. Helpers
-- ----------------------------------------------------------------------------

create or replace function empty_board_15()
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(row_json)
  from (
    select (select jsonb_agg('null'::jsonb) from generate_series(1, 15)) as row_json
    from generate_series(1, 15)
  ) t;
$$;

-- Returns the 5 winning cells as [[row,col], ...] if placing `symbol` at
-- (p_row, p_col) completes 5-in-a-row in any direction, otherwise null.
create or replace function check_win_line(board jsonb, p_row int, p_col int, symbol text)
returns jsonb
language plpgsql
as $$
declare
  dirs int[][] := array[[0,1],[1,0],[1,1],[1,-1]];
  i int;
  dr int;
  dc int;
  r int;
  c int;
  line jsonb;
  cnt int;
begin
  for i in 1..4 loop
    dr := dirs[i][1];
    dc := dirs[i][2];
    line := jsonb_build_array(jsonb_build_array(p_row, p_col));

    r := p_row + dr;
    c := p_col + dc;
    while r between 0 and 14 and c between 0 and 14 and (board -> r -> c) = to_jsonb(symbol) loop
      line := line || jsonb_build_array(jsonb_build_array(r, c));
      r := r + dr;
      c := c + dc;
    end loop;

    r := p_row - dr;
    c := p_col - dc;
    while r between 0 and 14 and c between 0 and 14 and (board -> r -> c) = to_jsonb(symbol) loop
      line := jsonb_build_array(jsonb_build_array(r, c)) || line;
      r := r - dr;
      c := c - dc;
    end loop;

    cnt := jsonb_array_length(line);
    if cnt >= 5 then
      return (
        select jsonb_agg(elem)
        from jsonb_array_elements(line) with ordinality as t(elem, ord)
        where ord <= 5
      );
    end if;
  end loop;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC functions (all SECURITY DEFINER — bypass RLS, enforce the rules)
-- ----------------------------------------------------------------------------

-- Creates a new room with the caller as Player 1 (BLACK).
create or replace function create_room(p_room_id text, p_player_id uuid, p_player_name text)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r rooms;
begin
  if p_player_name is null or length(trim(p_player_name)) = 0 then
    raise exception 'INVALID_NAME';
  end if;
  if exists (select 1 from rooms where id = p_room_id) then
    raise exception 'ROOM_EXISTS';
  end if;

  insert into rooms (id, player1_id, player1_name, board, current_turn, status)
  values (p_room_id, p_player_id, trim(p_player_name), empty_board_15(), 'B', 'waiting')
  returning * into r;

  return r;
end;
$$;

-- Joins an existing room as Player 2 (WHITE). If the caller already belongs
-- to the room (matching player1_id or player2_id), this is a no-op reconnect
-- that just returns the current state.
create or replace function join_room(p_room_id text, p_player_id uuid, p_player_name text)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r rooms;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if r.player1_id = p_player_id or r.player2_id = p_player_id then
    return r; -- already a member: reconnect
  end if;

  if r.player1_id is not null and r.player2_id is not null then
    raise exception 'ROOM_FULL';
  end if;

  if p_player_name is null or length(trim(p_player_name)) = 0 then
    raise exception 'INVALID_NAME';
  end if;

  if r.player1_id is null then
    update rooms
    set player1_id = p_player_id, player1_name = trim(p_player_name), updated_at = now()
    where id = p_room_id
    returning * into r;
  else
    update rooms
    set player2_id = p_player_id,
        player2_name = trim(p_player_name),
        status = 'playing',
        updated_at = now()
    where id = p_room_id
    returning * into r;
  end if;

  return r;
end;
$$;

-- Places a stone. Validates room existence, active status, turn order,
-- board bounds, and cell occupancy — then applies the move and checks for a
-- win or draw.
create or replace function make_move(p_room_id text, p_player_id uuid, p_row int, p_col int)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r rooms;
  my_symbol text;
  new_board jsonb;
  win_line jsonb;
  is_full boolean;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if r.status <> 'playing' then
    raise exception 'GAME_NOT_ACTIVE';
  end if;

  if p_player_id = r.player1_id then
    my_symbol := 'B';
  elsif p_player_id = r.player2_id then
    my_symbol := 'W';
  else
    raise exception 'NOT_A_PLAYER';
  end if;

  if r.current_turn <> my_symbol then
    raise exception 'NOT_YOUR_TURN';
  end if;

  if p_row < 0 or p_row > 14 or p_col < 0 or p_col > 14 then
    raise exception 'INVALID_CELL';
  end if;

  if (r.board -> p_row -> p_col) <> 'null'::jsonb then
    raise exception 'CELL_OCCUPIED';
  end if;

  new_board := jsonb_set(r.board, array[p_row::text, p_col::text], to_jsonb(my_symbol));
  win_line := check_win_line(new_board, p_row, p_col, my_symbol);

  is_full := not exists (
    select 1
    from jsonb_array_elements(new_board) as row_arr
    cross join jsonb_array_elements(row_arr) as cell
    where cell = 'null'::jsonb
  );

  update rooms
  set board = new_board,
      last_move = jsonb_build_array(p_row, p_col),
      winning_line = win_line,
      winner = case when win_line is not null then my_symbol when is_full then 'draw' else null end,
      status = case when win_line is not null or is_full then 'finished' else 'playing' end,
      current_turn = case when my_symbol = 'B' then 'W' else 'B' end,
      updated_at = now()
  where id = p_room_id
  returning * into r;

  return r;
end;
$$;

-- Marks the caller ready for a rematch. Once both players are ready, resets
-- the board in place (same room, same players, same colors).
create or replace function play_again(p_room_id text, p_player_id uuid)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r rooms;
  is_p1 boolean;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if r.status <> 'finished' then
    raise exception 'GAME_NOT_FINISHED';
  end if;

  if p_player_id = r.player1_id then
    is_p1 := true;
  elsif p_player_id = r.player2_id then
    is_p1 := false;
  else
    raise exception 'NOT_A_PLAYER';
  end if;

  if is_p1 then
    update rooms set player1_rematch = true, updated_at = now() where id = p_room_id;
  else
    update rooms set player2_rematch = true, updated_at = now() where id = p_room_id;
  end if;

  select * into r from rooms where id = p_room_id;

  if r.player1_rematch and r.player2_rematch then
    update rooms
    set board = empty_board_15(),
        current_turn = 'B',
        winner = null,
        winning_line = null,
        last_move = null,
        status = 'playing',
        player1_rematch = false,
        player2_rematch = false,
        updated_at = now()
    where id = p_room_id
    returning * into r;
  end if;

  return r;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Permissions
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on rooms to anon, authenticated;
grant execute on function create_room(text, uuid, text) to anon, authenticated;
grant execute on function join_room(text, uuid, text) to anon, authenticated;
grant execute on function make_move(text, uuid, int, int) to anon, authenticated;
grant execute on function play_again(text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Realtime
--
-- Enables live postgres_changes events for the rooms table. If your project
-- already has a `supabase_realtime` publication (most do by default), this
-- just adds the table to it.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table rooms;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Optional: cleanup of old rooms
--
-- This project intentionally keeps room storage minimal and does not build a
-- full expiry system. If you want to periodically remove old rooms, you can
-- schedule a query like this (e.g. via the pg_cron extension or a Supabase
-- Edge Function on a cron trigger):
--
--   delete from rooms where updated_at < now() - interval '24 hours';
-- ----------------------------------------------------------------------------
