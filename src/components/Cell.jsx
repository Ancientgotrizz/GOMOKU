import React from 'react';

function Cell({ value, isLastMove, isWinning, onClick, disabled, row, col }) {
  return (
    <button
      type="button"
      className={[
        'cell',
        value ? `cell--filled cell--${value}` : '',
        isLastMove ? 'cell--last' : '',
        isWinning ? 'cell--winning' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled || Boolean(value)}
      aria-label={
        value ? `${value === 'B' ? 'Black' : 'White'} stone at row ${row + 1}, column ${col + 1}` : `Empty cell, row ${row + 1}, column ${col + 1}`
      }
    >
      {value && <span className="stone" />}
    </button>
  );
}

export default React.memo(Cell);
