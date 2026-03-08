import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { useGame } from '../context/GameContext';
import { suggestLineup, previewLineups, getPlayerStats } from '../utils/lineup';
import { syncGameToSheet } from '../utils/sheetsSync';
import Scoreboard from '../components/Scoreboard';
import AlertBanner from '../components/AlertBanner';
import PlayerCard from '../components/PlayerCard';
import SubModal from '../components/SubModal';

const RATIO_OPTIONS = [
  { bx: 5, gx: 0 }, { bx: 4, gx: 1 }, { bx: 3, gx: 2 },
  { bx: 2, gx: 3 }, { bx: 1, gx: 4 }, { bx: 0, gx: 5 },
];

export default function GameView() {
  const navigate = useNavigate();
  const { state, dispatch, saveAndEndGame } = useGame();
  const players = useLiveQuery(() => db.players.toArray()) || [];

  const [tab, setTab] = useState('game'); // game | lineup | roster
  const [showSubModal, setShowSubModal] = useState(false);
  const [scorerMode, setScorerMode] = useState(null); // null | 'us' | 'them'
  const [swapTarget, setSwapTarget] = useState(null); // playerId being swapped out
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [tick, setTick] = useState(0);
  const [scoreConfirm, setScoreConfirm] = useState(null); // { scoredBy, scorer } pending confirmation
  const [undoAvailable, setUndoAvailable] = useState(null); // { scoredBy, timeout }
  const [showExport, setShowExport] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if no active game
  useEffect(() => {
    if (!state.active && state.phase !== 'finished') {
      navigate('/');
    }
  }, [state.active, state.phase, navigate]);

  const getPlayer = useCallback(id => players.find(p => p.id === id), [players]);

  // Compute player stats
  const playerStatsMap = useMemo(() => {
    const map = {};
    state.checkedInPlayerIds.forEach(id => {
      map[id] = getPlayerStats(id, state.points);
    });
    return map;
  }, [state.checkedInPlayerIds, state.points]);

  // Current ratio for this point
  const currentRatio = state.ratioOverride || state.ratioPattern[state.ratioIndex % state.ratioPattern.length];

  // Suggest lineup when entering pre-point with empty onField
  useEffect(() => {
    if (state.phase === 'pre-point' && state.onField.length === 0 && players.length > 0) {
      const suggested = suggestLineup(players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy);
      if (suggested.length > 0) {
        dispatch({ type: 'SET_LINEUP', lineup: suggested });
      }
    }
  }, [state.phase, state.onField.length, players.length]);

  // Preview next lineups
  const nextPreviews = useMemo(() => {
    if (players.length === 0) return [];
    const nextIdx = (state.ratioIndex + 1) % state.ratioPattern.length;
    return previewLineups(
      players, state.checkedInPlayerIds, state.ratioPattern, nextIdx,
      [...state.points, { lineup: state.onField, scoredBy: 'us', startedAt: null, endedAt: null, stats: [] }],
      2
    );
  }, [players, state.checkedInPlayerIds, state.ratioPattern, state.ratioIndex, state.points, state.onField]);

  // Game time alerts
  const gameElapsed = state.gameStartedAt ? (Date.now() - state.gameStartedAt) / 60000 : 0;
  const pointElapsed = state.pointStartedAt ? (Date.now() - state.pointStartedAt) / 60000 : 0;

  const alerts = [];
  // Halftime check
  if (!state.halftimeTaken) {
    if (state.ourScore >= 6 || state.theirScore >= 6) {
      alerts.push({ type: 'warning', message: 'Halftime -- a team reached 6 points', action: 'halftime' });
    } else if (gameElapsed >= 30) {
      const halfTarget = Math.max(state.ourScore, state.theirScore) + 1;
      alerts.push({ type: 'warning', message: `Half cap reached (30 min). Target: ${halfTarget}`, action: 'halftime' });
    }
  }
  // Hard cap
  if (gameElapsed >= 60) {
    alerts.push({ type: 'danger', message: 'HARD CAP -- 60 minutes. Finish current point.' });
  } else if (gameElapsed >= 55) {
    alerts.push({ type: 'warning', message: `Hard cap in ${Math.ceil(60 - gameElapsed)} min` });
  }

  // 10-min sub suggestion
  useEffect(() => {
    if (state.phase === 'playing' && pointElapsed >= 10) {
      if (!state.subDismissedAt || (Date.now() - state.subDismissedAt) > 120000) {
        setShowSubModal(true);
      }
    }
  }, [state.phase, Math.floor(pointElapsed), state.subDismissedAt]);

  // Sub suggestion lineup
  const subSuggestion = useMemo(() => {
    if (!showSubModal || players.length === 0) return [];
    return suggestLineup(players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy);
  }, [showSubModal, players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy]);

  // Undo timer - auto-dismiss after 8 seconds
  useEffect(() => {
    if (undoAvailable) {
      const timer = setTimeout(() => setUndoAvailable(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [undoAvailable]);

  function handleScore(scoredBy, scorer = null) {
    dispatch({ type: 'SCORE', scoredBy, scorer });
    setScorerMode(null);
    setScoreConfirm(null);
    setUndoAvailable({ scoredBy });
  }

  function handleUndo() {
    if (!undoAvailable) return;
    dispatch({ type: 'UNDO_SCORE' });
    setUndoAvailable(null);
  }

  function handleSwap(benchPlayerId) {
    if (!swapTarget) return;
    dispatch({ type: 'SWAP_PLAYER', outId: swapTarget, inId: benchPlayerId });
    setSwapTarget(null);
  }

  function handleAcceptSub() {
    dispatch({ type: 'SET_LINEUP', lineup: subSuggestion });
    setShowSubModal(false);
  }

  async function handleEndGame() {
    await saveAndEndGame();
    syncGameToSheet(state, players).catch(() => {}); // fire-and-forget, don't block
    navigate('/');
  }

  // Generate export data
  function generateExportCSV() {
    const lines = [];
    // Game summary
    lines.push('GAME SUMMARY');
    lines.push(`Opponent,${state.opponent}`);
    lines.push(`Date,${state.date}`);
    lines.push(`Start Time,${state.startTime}`);
    lines.push(`Field,${state.field}`);
    lines.push(`Final Score,${state.ourScore} - ${state.theirScore}`);
    lines.push(`Result,${state.ourScore > state.theirScore ? 'Win' : state.ourScore < state.theirScore ? 'Loss' : 'Tie'}`);
    lines.push('');
    // Player stats
    lines.push('PLAYER STATS');
    lines.push('Name,Gender,Grade,Points Played,+/-,Goals,Assists,Ds,Great Throws');
    state.checkedInPlayerIds.forEach(pid => {
      const p = getPlayer(pid);
      if (!p) return;
      const s = getPlayerStats(pid, state.points);
      lines.push(`${p.name},${p.gender},${p.grade},${s.pointsPlayed},${s.plusMinus >= 0 ? '+' : ''}${s.plusMinus},${s.scores},${s.assists},${s.ds},${s.greatThrows}`);
    });
    lines.push('');
    // Point log
    lines.push('POINT LOG');
    lines.push('Point,Scored By,Players On Field');
    (state.points || []).forEach((pt, i) => {
      const playerNames = pt.lineup.map(id => getPlayer(id)?.name || 'Unknown').join('; ');
      lines.push(`${i + 1},${pt.scoredBy === 'us' ? 'Marmots' : state.opponent},${playerNames}`);
    });
    return lines.join('\n');
  }

  function handleCopyExport() {
    const csv = generateExportCSV();
    navigator.clipboard.writeText(csv).then(() => {
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    });
  }

  function handleDownloadCSV() {
    const csv = generateExportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${state.date}_vs_${state.opponent.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const benchPlayers = state.checkedInPlayerIds.filter(id => !state.onField.includes(id));

  if (!state.active && state.phase !== 'finished') return null;

  return (
    <div className="min-h-dvh flex flex-col bg-navy-950">
      {/* Scoreboard - always visible (sticky via component) */}
      <Scoreboard
        ourScore={state.ourScore}
        theirScore={state.theirScore}
        opponent={state.opponent}
        gameStartedAt={state.gameStartedAt}
        pointStartedAt={state.pointStartedAt}
        phase={state.phase}
        currentPointNumber={state.currentPointNumber}
      />

      {/* Undo banner */}
      {undoAvailable && (
        <div className="bg-gold/20 border-b border-gold/40 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gold">
            {undoAvailable.scoredBy === 'us' ? 'Marmots' : 'Opponent'} scored
          </span>
          <button
            onClick={handleUndo}
            className="text-xs font-bold uppercase px-4 py-2 rounded-lg bg-gold text-navy-950 active:bg-gold-light"
            style={{ minHeight: '36px' }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Alerts */}
      {alerts.map((alert, i) => (
        <AlertBanner
          key={i}
          type={alert.type}
          message={alert.message}
          onAction={alert.action === 'halftime' ? () => dispatch({ type: 'START_HALFTIME' }) : undefined}
          actionLabel={alert.action === 'halftime' ? 'Take Half' : undefined}
        />
      ))}

      {/* Halftime overlay */}
      {state.phase === 'halftime' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="font-display text-4xl text-gold mb-2">HALFTIME</h2>
            <p className="text-navy-300 mb-6">
              {state.ourScore} - {state.theirScore} vs {state.opponent}
            </p>
            <button
              onClick={() => dispatch({ type: 'END_HALFTIME' })}
              className="btn-gold text-lg px-10"
            >
              Resume Play
            </button>
          </div>
        </div>
      )}

      {/* Finished overlay */}
      {state.phase === 'finished' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm">
            <h2 className="font-display text-4xl mb-2">
              {state.ourScore > state.theirScore ? (
                <span className="text-score-green">VICTORY</span>
              ) : state.ourScore < state.theirScore ? (
                <span className="text-score-red">DEFEAT</span>
              ) : (
                <span className="text-gold">TIE GAME</span>
              )}
            </h2>
            <div className="font-display text-6xl text-white my-4">
              {state.ourScore} - {state.theirScore}
            </div>
            <p className="text-navy-300 mb-6">vs {state.opponent}</p>

            {/* Export section */}
            {!showExport ? (
              <button
                onClick={() => setShowExport(true)}
                className="btn-primary w-full mb-3"
              >
                Export Game Data
              </button>
            ) : (
              <div className="card p-4 mb-3 space-y-3 text-left">
                <div className="text-xs uppercase text-navy-300 font-semibold">Export for Google Sheets</div>
                <p className="text-xs text-navy-400">Copy game data and paste it directly into your Google Sheet.</p>
                <button
                  onClick={handleCopyExport}
                  className="btn-gold w-full"
                >
                  {exportCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="btn-primary w-full"
                >
                  Download CSV
                </button>
              </div>
            )}

            <button onClick={handleEndGame} className="btn-gold text-lg px-10 w-full">
              Save & Exit
            </button>
          </div>
        </div>
      )}

      {/* Main game area */}
      {(state.phase === 'pre-point' || state.phase === 'playing') && (
        <div className="flex-1 overflow-y-auto pb-20">
          {/* Tab bar */}
          <div className="flex border-b border-navy-800">
            {[
              { id: 'game', label: 'Game' },
              { id: 'lineup', label: 'Lineup' },
              { id: 'roster', label: 'Roster' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-navy-300 active:text-white'
                }`}
                style={{ minHeight: '44px' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* GAME TAB */}
          {tab === 'game' && (
            <div className="p-4 space-y-4">
              {/* Score buttons or scorer select */}
              {scorerMode ? (
                <div className="space-y-2">
                  <div className="text-sm text-navy-300 text-center">
                    Who scored? (optional -- tap Skip to skip)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {state.onField.map(pid => {
                      const p = getPlayer(pid);
                      return p ? (
                        <button
                          key={pid}
                          onClick={() => handleScore(scorerMode, pid)}
                          className="card px-3 py-3 text-sm font-semibold active:bg-navy-700 text-center"
                          style={{ minHeight: '44px' }}
                        >
                          {p.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                  <button
                    onClick={() => handleScore(scorerMode)}
                    className="btn-primary w-full"
                  >
                    Skip -- No Attribution
                  </button>
                  <button
                    onClick={() => setScorerMode(null)}
                    className="text-sm text-navy-400 w-full text-center py-3"
                    style={{ minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {state.phase === 'pre-point' ? (
                    <button
                      onClick={() => dispatch({ type: 'START_POINT' })}
                      disabled={state.onField.length === 0}
                      className="btn-gold w-full text-lg py-5"
                    >
                      Start Point {state.currentPointNumber}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setScorerMode('us')} className="btn-score-us">
                        We Scored
                      </button>
                      <button onClick={() => setScorerMode('them')} className="btn-score-them">
                        They Scored
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Current lineup */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase text-navy-300 font-semibold">
                    On Field ({state.onField.length})
                  </span>
                  <span className="text-xs text-navy-400">
                    {currentRatio.bx}bx / {currentRatio.gx}gx
                  </span>
                </div>
                <div className="space-y-2">
                  {state.onField.map(pid => {
                    const player = getPlayer(pid);
                    const stats = playerStatsMap[pid];
                    return (
                      <PlayerCard
                        key={pid}
                        player={player}
                        stats={stats}
                        isOnField
                        showStats={state.phase === 'playing'}
                        onTap={() => setSwapTarget(swapTarget === pid ? null : pid)}
                        onStat={(playerId, statType) => dispatch({ type: 'ADD_STAT', playerId, statType })}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Swap panel */}
              {swapTarget && (
                <div className="card border-gold/50 p-3">
                  <div className="text-xs text-gold font-semibold mb-2">
                    Swap {getPlayer(swapTarget)?.name} with:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {benchPlayers.map(pid => {
                      const p = getPlayer(pid);
                      const stats = playerStatsMap[pid];
                      return p ? (
                        <button
                          key={pid}
                          onClick={() => handleSwap(pid)}
                          className="card px-3 py-3 text-left active:bg-navy-700"
                          style={{ minHeight: '44px' }}
                        >
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="text-[11px] text-navy-300">
                            {stats?.pointsPlayed || 0}pt played
                          </div>
                        </button>
                      ) : null;
                    })}
                  </div>
                  <button
                    onClick={() => setSwapTarget(null)}
                    className="text-sm text-navy-400 mt-2 w-full text-center py-2"
                    style={{ minHeight: '44px' }}
                  >
                    Cancel swap
                  </button>
                </div>
              )}

              {/* Current point stats */}
              {state.phase === 'playing' && state.currentStats.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-navy-300 font-semibold mb-1">Point Stats</div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.currentStats.map((s, i) => {
                      const p = getPlayer(s.playerId);
                      return (
                        <span
                          key={i}
                          onClick={() => dispatch({ type: 'REMOVE_STAT', playerId: s.playerId, statType: s.type })}
                          className="bg-navy-800 text-xs px-3 py-2 rounded-lg text-navy-200 active:bg-navy-700 cursor-pointer"
                          style={{ minHeight: '36px', display: 'inline-flex', alignItems: 'center' }}
                        >
                          {p?.name}: {s.type} x
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LINEUP TAB */}
          {tab === 'lineup' && (
            <div className="p-4 space-y-4">
              {/* Ratio override */}
              <div>
                <div className="text-xs uppercase text-navy-300 font-semibold mb-2">
                  Ratio for Point {state.currentPointNumber}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {RATIO_OPTIONS.map((r, i) => {
                    const isActive = currentRatio.bx === r.bx && currentRatio.gx === r.gx;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          dispatch({ type: 'OVERRIDE_RATIO', ratio: r });
                          // Re-suggest lineup with new ratio
                          const suggested = suggestLineup(players, state.checkedInPlayerIds, r, state.points, state.equalizeBy);
                          dispatch({ type: 'SET_LINEUP', lineup: suggested });
                        }}
                        className={`px-4 py-2.5 rounded-lg text-sm font-semibold ${
                          isActive ? 'bg-gold text-navy-950' : 'bg-navy-800 text-navy-200 active:bg-navy-700'
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        {r.bx}b/{r.gx}g
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equalize toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase text-navy-300 font-semibold">Equalize by:</span>
                <button
                  onClick={() => dispatch({ type: 'SET_EQUALIZE', equalizeBy: state.equalizeBy === 'points' ? 'time' : 'points' })}
                  className="text-sm font-semibold text-gold py-2"
                  style={{ minHeight: '44px' }}
                >
                  {state.equalizeBy === 'points' ? 'Points Played' : 'Minutes Played'} (tap to toggle)
                </button>
              </div>

              {/* Current lineup */}
              <div>
                <div className="text-xs uppercase text-navy-300 font-semibold mb-2">
                  Current Lineup -- Point {state.currentPointNumber}
                </div>
                <div className="space-y-1.5">
                  {state.onField.map(pid => {
                    const player = getPlayer(pid);
                    const stats = playerStatsMap[pid];
                    return (
                      <PlayerCard
                        key={pid}
                        player={player}
                        stats={stats}
                        isOnField
                        onTap={() => setSwapTarget(swapTarget === pid ? null : pid)}
                        compact
                      />
                    );
                  })}
                </div>
                {state.phase === 'pre-point' && (
                  <button
                    onClick={() => {
                      const suggested = suggestLineup(players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy);
                      dispatch({ type: 'SET_LINEUP', lineup: suggested });
                    }}
                    className="btn-primary w-full mt-2 py-3 text-sm"
                  >
                    Re-suggest Lineup
                  </button>
                )}
              </div>

              {/* Next up preview */}
              {nextPreviews.map((preview, i) => (
                <div key={i}>
                  <div className="text-xs uppercase text-navy-300 font-semibold mb-2">
                    Preview -- Point {state.currentPointNumber + i + 1} ({preview.ratio.bx}b/{preview.ratio.gx}g)
                  </div>
                  <div className="space-y-1">
                    {preview.lineup.map(pid => {
                      const player = getPlayer(pid);
                      return player ? (
                        <div key={pid} className="card px-3 py-2 text-sm flex items-center gap-2 opacity-60">
                          <span>{player.name}</span>
                          <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${
                            player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                          }`}>{player.gender}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ROSTER TAB */}
          {tab === 'roster' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase text-navy-300 font-semibold">
                  All Players ({state.checkedInPlayerIds.length} checked in)
                </span>
              </div>
              {state.checkedInPlayerIds
                .map(id => ({ player: getPlayer(id), stats: playerStatsMap[id] }))
                .filter(x => x.player)
                .sort((a, b) => (a.stats?.pointsPlayed || 0) - (b.stats?.pointsPlayed || 0))
                .map(({ player, stats }) => {
                  const isOnField = state.onField.includes(player.id);
                  return (
                    <div
                      key={player.id}
                      className={`card px-4 py-3 flex items-center justify-between ${
                        isOnField ? 'border-gold/30' : ''
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <div className="flex items-center gap-2">
                        {isOnField && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
                        <span className="font-semibold text-sm">{player.name}</span>
                        <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${
                          player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                        }`}>{player.gender}</span>
                        <span className="text-[10px] text-navy-300 font-mono">G{player.grade}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-navy-300">{stats?.pointsPlayed || 0} pts</span>
                        <span className={`font-semibold ${
                          (stats?.plusMinus || 0) >= 0 ? 'text-score-green' : 'text-score-red'
                        }`}>
                          {(stats?.plusMinus || 0) >= 0 ? '+' : ''}{stats?.plusMinus || 0}
                        </span>
                        {stats?.scores > 0 && <span className="text-gold">{stats.scores}g</span>}
                        <button
                          onClick={() => dispatch({ type: 'CHECK_OUT_PLAYER', playerId: player.id })}
                          className="text-navy-400 active:text-score-red ml-1 px-2 py-2"
                          style={{ minHeight: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Check out"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  );
                })}

              {/* End game button */}
              <div className="pt-6">
                {showEndConfirm ? (
                  <div className="card p-4 border-score-red/50 space-y-3">
                    <p className="text-sm text-center">End game and save? This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button onClick={handleEndGame} className="flex-1 btn bg-score-red text-white">
                        End Game
                      </button>
                      <button onClick={() => setShowEndConfirm(false)} className="flex-1 btn-primary">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="w-full text-sm text-navy-400 py-3 active:text-score-red"
                    style={{ minHeight: '44px' }}
                  >
                    End Game Early
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub suggestion modal */}
      <SubModal
        isOpen={showSubModal}
        suggestedLineup={subSuggestion}
        players={players}
        currentLineup={state.onField}
        onAccept={handleAcceptSub}
        onDismiss={() => {
          setShowSubModal(false);
          dispatch({ type: 'DISMISS_SUB' });
        }}
      />
    </div>
  );
}
