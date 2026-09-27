export const BOARD_SIZE = 15;

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function isBoardFull(board) {
  if (!board) return false;
  return board.every((row) => row.every((cell) => cell !== null));
}

export const SYMBOL_LABEL = {
  B: 'BLACK',
  W: 'WHITE',
};
