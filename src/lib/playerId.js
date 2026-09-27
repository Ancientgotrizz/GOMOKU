const KEY = 'gomoku_player_id';

// A stable anonymous identifier for this browser. Generated once and reused
// so a player can rejoin a room they already belong to without logging in.
export function getPlayerId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
