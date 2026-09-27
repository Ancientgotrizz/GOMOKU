import React, { useMemo } from 'react';
import Cell from './Cell';
import { BOARD_SIZE } from '../lib/gameLogic';

export default function Board({ board, onCellClick, disabled, lastMove, winningLine }) {
  const winningSet = useMemo(() => {
    if (!winningLine) return null;
    return new Set(winningLine.map(([r, c]) => `${r}-${c}`));
  }, [winningLine]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => (
        <span
          key={index}
          style={{
            '--confetti-left': `${(index * 47) % 100}%`,
            '--confetti-delay': `${(index % 6) * 0.045}s`,
            '--confetti-drift': `${((index * 23) % 120) - 60}px`,
            '--confetti-fall': `${180 + ((index * 31) % 160)}px`,
            '--confetti-rotation': `${((index * 113) % 720) - 360}deg`,
            '--confetti-color': ['var(--accent)', 'var(--accent-2)', 'var(--win)', 'var(--danger)'][index % 4],
          }}
        />
      )),
    []
  );

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
      {winningLine?.length > 0 && <div className="win-confetti" aria-hidden="true">{confetti}</div>}
    </div>
  );
}
