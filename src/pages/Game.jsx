import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useTheme } from '../hooks/useTheme';
import { normalizeRoomCode } from '../lib/room';
import Board from '../components/Board';
import PlayerPanel from '../components/PlayerPanel';
import GameStatus from '../components/GameStatus';
import ThemeSwitcher from '../components/ThemeSwitcher';
import Toast from '../components/Toast';

const MAX_NAME_LENGTH = 20;

function shareUrl(roomId) {
  return `${window.location.origin}/game/${roomId}`;
}

function useCopyLink(roomId) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl(roomId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be unavailable; fail silently, link is still visible
    }
  }
  return [copied, copy];
}

export default function Game() {
  const params = useParams();
  const roomId = normalizeRoomCode(params.roomId);
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const {
    room,
    phase,
    mySymbol,
    opponentOnline,
    connectionLost,
    actionError,
    clearActionError,
    join,
    move,
    requestPlayAgain,
  } = useGame(roomId);

  const [joinName, setJoinName] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [copied, copyLink] = useCopyLink(roomId);
  const [gameNotice, setGameNotice] = useState('');
  const [welcomeName, setWelcomeName] = useState('');
  const previousRoom = useRef(null);

  useEffect(() => {
    if (!room) return;

    const previous = previousRoom.current;
    if (previous) {
      if (!previous.player2Id && room.player2.id) {
        if (mySymbol === 'B') setGameNotice(`${room.player2.name} joined. Game on!`);
      }

      if (previous.status === 'playing' && room.status === 'finished') {
        const winnerName = room.winner === 'B' ? room.player1.name : room.winner === 'W' ? room.player2.name : null;
        setGameNotice(room.winner === 'draw' ? "A close game! It's a draw." : `${winnerName} wins! Great game!`);
      }
    }

    previousRoom.current = { player2Id: room.player2.id, status: room.status };
  }, [room, mySymbol]);

  useEffect(() => {
    if (!gameNotice) return undefined;
    const timeout = setTimeout(() => setGameNotice(''), 3600);
    return () => clearTimeout(timeout);
  }, [gameNotice]);

  useEffect(() => {
    if (!welcomeName) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setWelcomeName('');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [welcomeName]);

  useEffect(() => {
    if (!actionError) return undefined;
    const t = setTimeout(clearActionError, 2600);
    return () => clearTimeout(t);
  }, [actionError, clearActionError]);

  async function handleJoinSubmit(e) {
    e.preventDefault();
    const trimmed = joinName.trim();
    if (!trimmed) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      await join(trimmed);
      setWelcomeName(trimmed);
    } catch (err) {
      if (err.message?.includes('ROOM_FULL')) {
        setJoinError('This game just filled up.');
      } else {
        setJoinError('Could not join. Please try again.');
      }
    } finally {
      setJoinBusy(false);
    }
  }

  function handleCellClick(row, col) {
    if (!room || room.status !== 'playing') return;
    if (room.currentTurn !== mySymbol) return;
    if (!opponentOnline) return;
    move(row, col);
  }

  const topbar = (
    <div className="topbar">
      <button type="button" className="link-btn" onClick={() => navigate('/')}>
        ← Home
      </button>
      <ThemeSwitcher theme={theme} setTheme={setTheme} />
    </div>
  );

  if (phase === 'loading') {
    return (
      <div className="page page--center">
        {topbar}
        <div className="loading-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (phase === 'not_found') {
    return (
      <div className="page page--center">
        {topbar}
        <div className="message-card">
          <h2>GAME NOT FOUND</h2>
          <p>This room does not exist or has expired.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            Back Home
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'full') {
    return (
      <div className="page page--center">
        {topbar}
        <div className="message-card">
          <h2>GAME FULL</h2>
          <p>This game already has two players.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            Back Home
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'need_join') {
    return (
      <div className="page page--center">
        {topbar}
        <form className="home-form" onSubmit={handleJoinSubmit}>
          <h2 className="home-form__heading">Enter your name</h2>
          <input
            className="home-form__input"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="Rahul"
            autoFocus
            maxLength={MAX_NAME_LENGTH}
          />
          {joinError && <div className="home-form__error">{joinError}</div>}
          <button type="submit" className="btn btn--primary" disabled={joinBusy || !joinName.trim()}>
            {joinBusy ? 'Joining…' : 'Join Game'}
          </button>
        </form>
      </div>
    );
  }

  if (!room) return null;

  if (room.status === 'waiting') {
    return (
      <div className="page page--center">
        {topbar}
        <div className="message-card">
          <h2>GAME CREATED</h2>
          <div className="room-code-block">
            <div className="room-code-block__label">Room Code</div>
            <div className="room-code-block__value">{roomId}</div>
          </div>
          <p className="share-hint">Share this link:</p>
          <div className="share-link">{shareUrl(roomId)}</div>
          <button type="button" className="btn btn--secondary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <div className="status-banner status-banner--waiting" style={{ marginTop: '1.5rem' }}>
            <span className="pulse-dot" /> Waiting for opponent…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--game">
      {topbar}
      {connectionLost && <div className="status-banner status-banner--warning connection-banner">CONNECTION LOST — trying to reconnect…</div>}

      <div className="game-header">
        <h1 className="game-title">GOMOKU</h1>
      </div>

      <PlayerPanel
        player1={room.player1}
        player2={room.player2}
        mySymbol={mySymbol}
        currentTurn={room.currentTurn}
        opponentOnline={opponentOnline}
      />

      <GameStatus
        status={room.status}
        winner={room.winner}
        mySymbol={mySymbol}
        currentTurn={room.currentTurn}
        player1={room.player1}
        player2={room.player2}
        opponentOnline={opponentOnline}
        onPlayAgain={requestPlayAgain}
        myRematchReady={mySymbol === 'B' ? room.player1Rematch : room.player2Rematch}
        opponentRematchReady={mySymbol === 'B' ? room.player2Rematch : room.player1Rematch}
      />

      <Board
        board={room.board}
        onCellClick={handleCellClick}
        disabled={room.status !== 'playing' || room.currentTurn !== mySymbol || !opponentOnline}
        lastMove={room.lastMove}
        winningLine={room.winningLine}
      />

      <div className="game-footer">
        <div className="game-footer__room">Room: {roomId}</div>
        <div className="game-footer__actions">
          <button type="button" className="btn btn--ghost" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Game Link'}
          </button>
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => navigate('/')}>
            Leave Game
          </button>
        </div>
      </div>

      <Toast message={actionError || gameNotice} />
      {welcomeName && (
        <div
          className="welcome-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setWelcomeName('');
          }}
        >
          <section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="welcome-modal__mark" aria-hidden="true">G</div>
            <h2 id="welcome-title">WELCOME!</h2>
            <p>Welcome to the game MISS ,kil. Happy playing!</p>
            <button type="button" className="btn btn--primary" autoFocus onClick={() => setWelcomeName('')}>
              Let’s play
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
