import React from 'react';

export default function GameStatus({
  status,
  winner,
  mySymbol,
  currentTurn,
  player1,
  player2,
  opponentOnline,
  onPlayAgain,
  myRematchReady,
  opponentRematchReady,
}) {
  if (status === 'waiting') {
    return (
      <div className="status-banner status-banner--waiting">
        <span className="pulse-dot" /> Waiting for opponent…
      </div>
    );
  }

  if (status === 'playing') {
    if (!opponentOnline) {
      return (
        <div className="status-banner status-banner--warning">
          Opponent disconnected — waiting for opponent…
        </div>
      );
    }
    const isMyTurn = currentTurn === mySymbol;
    return (
      <div className={`status-banner ${isMyTurn ? 'status-banner--your-turn' : ''}`}>
        {isMyTurn ? 'YOUR TURN' : `${currentTurn === 'B' ? player1.name : player2.name}'s turn`}
      </div>
    );
  }

  if (status === 'finished') {
    const winnerName = winner === 'B' ? player1.name : winner === 'W' ? player2.name : null;
    return (
      <div className="status-banner status-banner--result">
        <div className="status-banner__headline">
          {winner === 'draw' ? 'DRAW' : `${winnerName?.toUpperCase()} WINS`}
        </div>
        {!opponentOnline && (
          <div className="status-banner__note">Opponent disconnected — waiting for opponent…</div>
        )}
        {myRematchReady && !opponentRematchReady ? (
          <div className="status-banner__note">Waiting for opponent to play again…</div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
            Play Again
          </button>
        )}
      </div>
    );
  }

  return null;
}
