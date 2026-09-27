import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomCode, normalizeRoomCode, saveRoomMembership } from '../lib/room';
import { createRoom } from '../lib/api';
import { getPlayerId } from '../lib/playerId';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { useTheme } from '../hooks/useTheme';

const MAX_NAME_LENGTH = 20;

export default function Home() {
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState('landing'); // landing | create | join
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const playerId = getPlayerId();
      let roomId = generateRoomCode();
      let attempts = 0;
      // extremely unlikely collision, but retry a couple times just in case
      while (attempts < 3) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await createRoom(roomId, playerId, trimmed);
          break;
        } catch (err) {
          if (err.message?.includes('ROOM_EXISTS') && attempts < 2) {
            roomId = generateRoomCode();
            attempts += 1;
          } else {
            throw err;
          }
        }
      }
      saveRoomMembership(roomId, trimmed);
      navigate(`/game/${roomId}`);
    } catch (err) {
      setError('Could not create the game. Please try again.');
      setBusy(false);
    }
  }

  function handleJoinByCode(e) {
    e.preventDefault();
    const trimmed = normalizeRoomCode(code);
    if (!trimmed) return;
    navigate(`/game/${trimmed}`);
  }

  return (
    <div className="page page--home">
      <div className="topbar">
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
      </div>

      <div className="home-hero">
        <h1 className="home-title">GOMOKU</h1>
        <p className="home-tagline">Two players. One board.</p>

        {view === 'landing' && (
          <div className="home-actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => setView('create')}>
              Create Game
            </button>
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => setView('join')}>
              Join Game
            </button>
          </div>
        )}

        {view === 'create' && (
          <form className="home-form" onSubmit={handleCreate}>
            <label className="home-form__label" htmlFor="create-name">
              Your Name
            </label>
            <input
              id="create-name"
              className="home-form__input"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="ANCIENT"
              autoFocus
              maxLength={MAX_NAME_LENGTH}
            />
            {error && <div className="home-form__error">{error}</div>}
            <div className="home-form__row">
              <button type="button" className="btn btn--ghost" onClick={() => setView('landing')} disabled={busy}>
                Back
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy || !name.trim()}>
                {busy ? 'Creating…' : 'Create Game'}
              </button>
            </div>
          </form>
        )}

        {view === 'join' && (
          <form className="home-form" onSubmit={handleJoinByCode}>
            <label className="home-form__label" htmlFor="join-code">
              Room Code
            </label>
            <input
              id="join-code"
              className="home-form__input home-form__input--code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="AB12CD"
              autoFocus
            />
            <div className="home-form__row">
              <button type="button" className="btn btn--ghost" onClick={() => setView('landing')}>
                Back
              </button>
              <button type="submit" className="btn btn--primary" disabled={!code.trim()}>
                Join
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
