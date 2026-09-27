import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getPlayerId } from '../lib/playerId';
import { fetchRoom, joinRoom as apiJoinRoom, makeMove as apiMakeMove, playAgain as apiPlayAgain } from '../lib/api';
import { saveRoomMembership } from '../lib/room';

function mapRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    player1: { id: row.player1_id, name: row.player1_name },
    player2: { id: row.player2_id, name: row.player2_name },
    board: row.board,
    currentTurn: row.current_turn,
    status: row.status,
    winner: row.winner,
    winningLine: row.winning_line || null,
    lastMove: row.last_move || null,
    player1Rematch: row.player1_rematch,
    player2Rematch: row.player2_rematch,
  };
}

export function useGame(roomId) {
  const playerId = useMemo(() => getPlayerId(), []);
  const [room, setRoom] = useState(null);
  // loading | not_found | full | need_join | in_game
  const [phase, setPhase] = useState('loading');
  const [actionError, setActionError] = useState(null);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [connectionLost, setConnectionLost] = useState(false);

  const evaluatePhase = useCallback(
    (mapped) => {
      if (!mapped) {
        setPhase('not_found');
        return;
      }
      const isMember = mapped.player1.id === playerId || mapped.player2.id === playerId;
      if (isMember) {
        setPhase('in_game');
        return;
      }
      if (mapped.player1.id && mapped.player2.id) {
        setPhase('full');
        return;
      }
      setPhase('need_join');
    },
    [playerId]
  );

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setRoom(null);
    setConnectionLost(false);

    fetchRoom(roomId)
      .then((row) => {
        if (cancelled) return;
        const mapped = mapRoom(row);
        setRoom(mapped);
        evaluatePhase(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setPhase('not_found');
      });

    const channel = supabase
      .channel(`room-db-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setRoom(null);
            setPhase('not_found');
            return;
          }
          const mapped = mapRoom(payload.new);
          setRoom(mapped);
          evaluatePhase(mapped);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionLost(true);
        } else if (status === 'SUBSCRIBED') {
          setConnectionLost(false);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, evaluatePhase]);

  // Presence: lets each browser know whether the opponent's tab is open.
  useEffect(() => {
    if (phase !== 'in_game' && phase !== 'need_join') return undefined;

    const presence = supabase.channel(`room-presence-${roomId}`, {
      config: { presence: { key: playerId } },
    });

    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      const onlineIds = Object.keys(state);
      setRoom((current) => {
        if (current) {
          const opponentId = current.player1.id === playerId ? current.player2.id : current.player1.id;
          setOpponentOnline(!opponentId || onlineIds.includes(opponentId));
        }
        return current;
      });
    });

    presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presence.track({ online_at: Date.now() });
      }
    });

    return () => {
      supabase.removeChannel(presence);
    };
  }, [roomId, playerId, phase]);

  const join = useCallback(
    async (name) => {
      setActionError(null);
      const row = await apiJoinRoom(roomId, playerId, name);
      saveRoomMembership(roomId, name);
      const mapped = mapRoom(row);
      setRoom(mapped);
      evaluatePhase(mapped);
    },
    [roomId, playerId, evaluatePhase]
  );

  const move = useCallback(
    async (row, col) => {
      setActionError(null);
      try {
        await apiMakeMove(roomId, playerId, row, col);
      } catch (err) {
        setActionError(err.message);
      }
    },
    [roomId, playerId]
  );

  const requestPlayAgain = useCallback(async () => {
    setActionError(null);
    try {
      await apiPlayAgain(roomId, playerId);
    } catch (err) {
      setActionError(err.message);
    }
  }, [roomId, playerId]);

  const mySymbol = useMemo(() => {
    if (!room) return null;
    if (room.player1.id === playerId) return 'B';
    if (room.player2.id === playerId) return 'W';
    return null;
  }, [room, playerId]);

  return {
    playerId,
    room,
    phase,
    mySymbol,
    opponentOnline,
    connectionLost,
    actionError,
    clearActionError: () => setActionError(null),
    join,
    move,
    requestPlayAgain,
  };
}
