import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSpectatorGame } from '../hooks/useSpectatorGame';
import { usePlayers } from '../hooks/usePlayers';
import { useSpectatorStats } from '../hooks/useSpectatorStats';
import { useScheduledGames } from '../hooks/useScheduledGames';
import { getAggregatedPlayerStats } from '../utils/pointStats';
import Scoreboard from '../components/Scoreboard';
import PointStrip from '../components/PointStrip';
import SpectatorPlayerCard from '../components/SpectatorPlayerCard';
import SpectatorStatBar from '../components/SpectatorStatBar';

export default function SpectatorView() {
  const { gameId } = useParams();

  // Nickname gate
  const [nickname, setNickname] = useState(() => localStorage.getItem('spectatorNickname') || null);
  const [nicknameInput, setNicknameInput] = useState('');

  // Game state
  const game = useSpectatorGame();
  const players = usePlayers();
  const { spectatorStats, addSpectatorStat } = useSpectatorStats(gameId);
  const { scheduledGames } = useScheduledGames();

  // UI state
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [toast, setToast] = useState(null);

  // Reset to current point on score change
  useEffect(() => {
    if (game) setSelectedPointIndex(null);
  }, [game?.ourScore, game?.theirScore]);

  function handleJoin(e) {
    e.preventDefault();
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    localStorage.setItem('spectatorNickname', trimmed);
    setNickname(trimmed);
  }

  // Determine which player IDs are on field for the viewed point
  const onFieldIds = useMemo(() => {
    if (!game) return [];
    if (selectedPointIndex === null) return game.onField || [];
    return game.points?.[selectedPointIndex]?.lineup || [];
  }, [game, selectedPointIndex]);

  // Separate checked-in players into on-field and bench
  const checkedInPlayerIds = game?.checkedInPlayerIds || [];

  const checkedInPlayers = useMemo(() => {
    return players.filter(p => checkedInPlayerIds.includes(p.id));
  }, [players, checkedInPlayerIds]);

  const onFieldPlayers = useMemo(() => {
    return checkedInPlayers.filter(p => onFieldIds.includes(p.id));
  }, [checkedInPlayers, onFieldIds]);

  const benchPlayers = useMemo(() => {
    return checkedInPlayers.filter(p => !onFieldIds.includes(p.id));
  }, [checkedInPlayers, onFieldIds]);

  // Build per-player spectator stat counts from spectatorStats array
  const spectatorStatsByPlayer = useMemo(() => {
    const map = {};
    for (const s of (spectatorStats || [])) {
      if (!map[s.playerId]) map[s.playerId] = { goals: 0, assists: 0, ds: 0 };
      if (s.type === 'goal') map[s.playerId].goals++;
      else if (s.type === 'assist') map[s.playerId].assists++;
      else if (s.type === 'D') map[s.playerId].ds++;
    }
    return map;
  }, [spectatorStats]);

  const selectedPlayer = selectedPlayerId
    ? players.find(p => p.id === selectedPlayerId) || null
    : null;

  async function handleRecordStat(type) {
    const currentPointIndex = selectedPointIndex ?? (game?.points?.length || 0);
    const coachStats =
      selectedPointIndex !== null
        ? (game?.points?.[selectedPointIndex]?.stats || [])
        : (game?.currentStats || []);

    const result = await addSpectatorStat({
      gameId: String(game.id),
      pointIndex: currentPointIndex,
      playerId: selectedPlayerId,
      type,
      nickname,
      coachStats,
    });

    if (result.success) {
      setToast({ text: 'Recorded!', type: 'success' });
    } else {
      setToast({ text: result.reason, type: 'warning' });
    }
    setTimeout(() => setToast(null), 2000);
  }

  // Nickname modal — shown before anything else
  if (!nickname) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-navy-950 px-4">
        <div className="bg-navy-800 rounded-xl p-6 w-full max-w-sm">
          <h2 className="font-display text-3xl text-gold mb-1 text-center">Join as Spectator</h2>
          <p className="text-navy-300 text-sm text-center mb-5">Enter a name so coaches can see who's recording stats.</p>
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={nicknameInput}
              onChange={e => setNicknameInput(e.target.value)}
              className="w-full"
              autoFocus
            />
            <button
              type="submit"
              className="btn-gold w-full"
              disabled={!nicknameInput.trim()}
            >
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading
  if (game === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-navy-950">
        <div className="text-navy-400 text-sm">Loading game...</div>
      </div>
    );
  }

  // No active game or ID mismatch — check if it's a scheduled game
  const scheduledMatch = (game === null || (game && String(game.id) !== gameId))
    ? scheduledGames.find(g => String(g.spectatorId) === gameId)
    : null;

  if (game === null || (game && String(game.id) !== gameId)) {
    if (scheduledMatch) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center bg-navy-950 text-white px-4 text-center">
          <div className="font-display text-4xl text-gold mb-2">Wedgwood Marmots</div>
          <p className="text-xl font-semibold mt-2">vs {scheduledMatch.opponent}</p>
          {scheduledMatch.startTime && (
            <p className="text-gold font-semibold mt-1">{scheduledMatch.startTime}</p>
          )}
          {scheduledMatch.field && (
            <p className="text-navy-400 text-sm mt-1">{scheduledMatch.field}</p>
          )}
          <p className="text-navy-300 text-sm mt-4">Game hasn't started yet.</p>
          <p className="text-navy-400 text-xs mt-1">This page will update live once it begins.</p>
        </div>
      );
    }
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-navy-950 text-white px-4 text-center">
        <div className="font-display text-4xl text-gold mb-2">Wedgwood Marmots</div>
        <p className="text-navy-300 text-sm">{game === null ? 'No active game right now.' : 'This game is not currently active.'}</p>
        <p className="text-navy-400 text-xs mt-2">Check back when a game is in progress.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-navy-950 text-white">
      {/* Scoreboard */}
      <Scoreboard
        ourScore={game.ourScore}
        theirScore={game.theirScore}
        opponent={game.opponent}
        gameStartedAt={game.gameStartedAt}
        phase={game.phase}
        currentPointNumber={game.currentPointNumber}
      />

      {/* Point strip — read only, no future lineups */}
      <PointStrip
        points={game.points || []}
        currentPointNumber={game.currentPointNumber}
        ourScore={game.ourScore}
        theirScore={game.theirScore}
        selectedIndex={selectedPointIndex}
        futureLineups={[]}
        onSelectPoint={setSelectedPointIndex}
        phase={game.phase}
      />

      {/* Player list */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* On Field section */}
        <div className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-2 mt-3">
          On Field
        </div>
        {onFieldPlayers.length === 0 && (
          <p className="text-navy-500 text-sm py-2">No players on field yet.</p>
        )}
        {onFieldPlayers.map(p => (
          <SpectatorPlayerCard
            key={p.id}
            player={p}
            isOnField={true}
            isSelected={selectedPlayerId === p.id}
            coachStats={getAggregatedPlayerStats(p.id, game.points || [])}
            spectatorStats={spectatorStatsByPlayer[p.id] || { goals: 0, assists: 0, ds: 0 }}
            onTap={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
          />
        ))}

        {/* Bench section */}
        <div className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-2 mt-4 border-t border-navy-700 pt-3">
          Bench
        </div>
        {benchPlayers.length === 0 && (
          <p className="text-navy-500 text-sm py-2">No players on bench.</p>
        )}
        {benchPlayers.map(p => (
          <SpectatorPlayerCard
            key={p.id}
            player={p}
            isOnField={false}
            isSelected={selectedPlayerId === p.id}
            coachStats={getAggregatedPlayerStats(p.id, game.points || [])}
            spectatorStats={spectatorStatsByPlayer[p.id] || { goals: 0, assists: 0, ds: 0 }}
            onTap={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
          />
        ))}
      </div>

      {/* Stat bar — only when player selected */}
      {selectedPlayer && (
        <SpectatorStatBar
          selectedPlayer={selectedPlayer}
          onRecordStat={handleRecordStat}
          onDeselect={() => setSelectedPlayerId(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-16 left-4 right-4 z-50 px-4 py-3 rounded-xl text-center text-sm font-semibold animate-slide-up ${
            toast.type === 'success'
              ? 'bg-green-600/90 text-white'
              : 'bg-gold/90 text-navy-950'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
