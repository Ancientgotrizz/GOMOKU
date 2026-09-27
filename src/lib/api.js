import { supabase } from './supabase';

// All game-state mutations go through Postgres functions (RPC) rather than
// direct table writes, so turn order, occupied cells, and win detection are
// validated server-side and can't be bypassed by a manipulated client.

function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message || 'UNKNOWN_ERROR');
  }
  return data;
}

export async function createRoom(roomId, playerId, playerName) {
  return unwrap(
    await supabase.rpc('create_room', {
      p_room_id: roomId,
      p_player_id: playerId,
      p_player_name: playerName,
    })
  );
}

export async function joinRoom(roomId, playerId, playerName) {
  return unwrap(
    await supabase.rpc('join_room', {
      p_room_id: roomId,
      p_player_id: playerId,
      p_player_name: playerName,
    })
  );
}

export async function makeMove(roomId, playerId, row, col) {
  return unwrap(
    await supabase.rpc('make_move', {
      p_room_id: roomId,
      p_player_id: playerId,
      p_row: row,
      p_col: col,
    })
  );
}

export async function playAgain(roomId, playerId) {
  return unwrap(
    await supabase.rpc('play_again', {
      p_room_id: roomId,
      p_player_id: playerId,
    })
  );
}

export async function fetchRoom(roomId) {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw new Error(error.message || 'UNKNOWN_ERROR');
  return data;
}
