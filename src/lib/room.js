// Characters chosen to avoid visual ambiguity (no 0/O, 1/I, etc.)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(code) {
  return (code || '').trim().toUpperCase();
}

function membershipKey(roomId) {
  return `gomoku_room_${roomId}`;
}

// Remembers "I already joined this room as <name>" so a page reload or a
// return visit to the same link can skip straight back into the game.
export function saveRoomMembership(roomId, name) {
  localStorage.setItem(membershipKey(roomId), JSON.stringify({ name, joinedAt: Date.now() }));
}

export function getRoomMembership(roomId) {
  try {
    const raw = localStorage.getItem(membershipKey(roomId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearRoomMembership(roomId) {
  localStorage.removeItem(membershipKey(roomId));
}
