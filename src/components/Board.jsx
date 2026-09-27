import React, { useMemo } from 'react';
import Cell from './Cell';
import { BOARD_SIZE } from '../lib/gameLogic';

export default function Board({ board, onCellClick, disabled, lastMove, winningLine }) {
  const winningSet = useMemo(() => {
    if (!winningLine) return null;
    return new Set(winningLine.map(([r, c]) => `${r}-${c}`));
  }, [winningLine]);

  return (
    <div className="board-wrap">
      <div
        className="board"
        style={{ '--board-size': BOARD_SIZE }}
        role="grid"
        aria-label="Gomoku board"
      >
        {board.map((rowArr, r) =>
          rowArr.map((value, c) => (
            <Cell
              key={`${r}-${c}`}
              row={r}
              col={c}
              value={value}
              disabled={disabled}
              isLastMove={Boolean(lastMove && lastMove[0] === r && lastMove[1] === c)}
              isWinning={Boolean(winningSet && winningSet.has(`${r}-${c}`))}
              onClick={() => onCellClick(r, c)}
            />
          ))
        )}
      </div>
    </div>
  );
}
