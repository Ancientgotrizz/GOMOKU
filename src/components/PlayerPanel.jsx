import React from 'react';

function PlayerCard({ name, symbol, isTurn, isMe, connected }) {
  return (
    <div className={`player-card ${isTurn ? 'player-card--active' : ''}`}>
      <div className={`player-stone player-stone--${symbol}`} aria-hidden="true" />
      <div className="player-card__info">
        <div className="player-card__name">
          {name || 'Waiting…'}
          {isMe && <span className="player-card__you"> (you)</span>}
        </div>
        <div className="player-card__meta">
          <span>{symbol === 'B' ? 'BLACK' : 'WHITE'}</span>
          {name && !connected && <span className="player-card__offline">· offline</span>}
        </div>
      </div>
    </div>
  );
}

export default function PlayerPanel({ player1, player2, mySymbol, currentTurn, opponentOnline }) {
  return (
    <div className="player-panel">
      <PlayerCard
        name={player1.name}
        symbol="B"
        isTurn={currentTurn === 'B'}
        isMe={mySymbol === 'B'}
        connected={mySymbol === 'W' ? opponentOnline : true}
      />
      <div className="player-panel__vs">VS</div>
      <PlayerCard
        name={player2.name}
        symbol="W"
        isTurn={currentTurn === 'W'}
        isMe={mySymbol === 'W'}
        connected={mySymbol === 'B' ? opponentOnline : true}
      />
    </div>
  );
}
