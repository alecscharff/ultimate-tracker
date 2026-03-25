import { useMemo, useState, useEffect } from 'react';
import { ACTIONS } from '../context/GameContext';
import { getDetailedPlayerStats, suggestLineup } from '../utils/lineup';
import { getPointFlipInfo } from '../utils/gameUtils';
import LineupPlayerRow from './LineupPlayerRow';
import PlayerStatModal from './PlayerStatModal';
import PlayerInfoModal from './PlayerInfoModal';

const RATIO_OPTIONS = [
  { bx: 4, gx: 1 },
  { bx: 3, gx: 2 },
  { bx: 2, gx: 3 },
  { bx: 1, gx: 4 },
];

const RATIO_PRESETS = [
  { bx: 3, gx: 2 },
  { bx: 2, gx: 3 },
  { bx: 4, gx: 1 },
  { bx: 1, gx: 4 },
  { bx: 5, gx: 0 },
  { bx: 0, gx: 5 },
];

export default function PointDetailView({
  gameState,
  players,
  selectedPointIndex,
  futureLineups,
  dispatch,
  sittingOutIds = new Set(),
  onSitPlayer,
  onUnsitPlayer,
}) {
  const {
    points,
    onField,
    checkedInPlayerIds,
    phase,
    ratioPattern,
    ratioIndex,
    ratioOverride,
    equalizeBy,
    currentStats,
    unavailablePlayerIds = [],
    gameStartedAt,
  } = gameState;

  // Determine what we're viewing
  const isPastPoint = selectedPointIndex !== null && selectedPointIndex < points.length;
  const isFuturePoint = selectedPointIndex !== null && selectedPointIndex >= points.length;
  const isCurrentPoint = selectedPointIndex === null;

  // Current point is at index === points.length (0-based)
  const currentPointIndex = points.length;

  // Local state for future-point ratio override (view-only, not persisted to game state)
  const [overrideRatioForFuture, setOverrideRatioForFuture] = useState(null);
  const [showRatioModal, setShowRatioModal] = useState(false);

  // Info modal state
  const [infoModalPlayerId, setInfoModalPlayerId] = useState(null);

  // Mid-point swap state (two-tap flow: select out player → select in player)
  const [swappingOutId, setSwappingOutId] = useState(null);

  // Past point edit state
  const [editingPastPoint, setEditingPastPoint] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  // Past point lineup being edited (local copy of the lineup)
  const [editedLineup, setEditedLineup] = useState(null);

  useEffect(() => {
    setEditingPastPoint(false);
    setShowEditConfirm(false);
    setEditedLineup(null);
  }, [selectedPointIndex]);

  // Clear mid-point swap when point ends
  useEffect(() => {
    setSwappingOutId(null);
  }, [gameState.ourScore, gameState.theirScore, gameState.phase]);

  // Sync editedLineup when entering edit mode
  useEffect(() => {
    if (editingPastPoint && isPastPoint) {
      setEditedLineup([...(points[selectedPointIndex]?.lineup || [])]);
    } else {
      setEditedLineup(null);
    }
  }, [editingPastPoint]);

  // When viewing a future point, compute a projected lineup for the active override ratio
  const projectedLineup = useMemo(() => {
    if (!isFuturePoint || !overrideRatioForFuture) return null;
    return suggestLineup(players, checkedInPlayerIds, overrideRatioForFuture, points, equalizeBy);
  }, [isFuturePoint, overrideRatioForFuture, players, checkedInPlayerIds, points, equalizeBy]);

  // Resolve the lineup to display
  const displayLineupIds = useMemo(() => {
    if (isPastPoint) {
      // In edit mode use the local editable copy
      if (editingPastPoint && editedLineup !== null) return editedLineup;
      return points[selectedPointIndex]?.lineup || [];
    }
    if (isFuturePoint) {
      if (overrideRatioForFuture && projectedLineup) return projectedLineup;
      const preview = futureLineups.find(f => f.pointNumber - 1 === selectedPointIndex);
      return preview?.lineup || [];
    }
    // Current point
    return onField;
  }, [isPastPoint, isFuturePoint, selectedPointIndex, points, futureLineups, onField, overrideRatioForFuture, projectedLineup, editingPastPoint, editedLineup]);

  // Compute game-relative minute a player last played (from game start = 0)
  function gameMinute(lastPointEndedAt) {
    if (!lastPointEndedAt || !gameStartedAt) return null;
    return Math.round((lastPointEndedAt - gameStartedAt) / 60000);
  }

  const now = Date.now();

  // Bench players for current point (sorted by bench time desc)
  const benchPlayerIds = useMemo(() => {
    if (!isCurrentPoint) return [];
    const onFieldSet = new Set(displayLineupIds);
    const unavailableSet = new Set(unavailablePlayerIds);
    const bench = checkedInPlayerIds.filter(id => !onFieldSet.has(id) && !unavailableSet.has(id));
    return bench.sort((a, b) => {
      const sa = getDetailedPlayerStats(a, points, now);
      const sb = getDetailedPlayerStats(b, points, now);
      return sb.benchTimeMs - sa.benchTimeMs;
    });
  }, [isCurrentPoint, displayLineupIds, checkedInPlayerIds, unavailablePlayerIds, points, now]);

  // Checked-out players (not on field, not in checkedInPlayerIds) for current point
  const checkedOutPlayerIds = useMemo(() => {
    if (!isCurrentPoint) return [];
    const onFieldSet = new Set(displayLineupIds);
    const checkedInSet = new Set(checkedInPlayerIds);
    const unavailableSet = new Set(unavailablePlayerIds);
    return players
      .map(p => p.id)
      .filter(id => !onFieldSet.has(id) && !checkedInSet.has(id) && !unavailableSet.has(id));
  }, [isCurrentPoint, displayLineupIds, checkedInPlayerIds, unavailablePlayerIds, players]);

  // Stats for the viewed point
  const viewedStats = useMemo(() => {
    if (isPastPoint) return points[selectedPointIndex]?.stats || [];
    if (isCurrentPoint) return currentStats;
    return [];
  }, [isPastPoint, isCurrentPoint, selectedPointIndex, points, currentStats]);

  // Stats index for dispatching (null = current point)
  const statPointIndex = isPastPoint ? selectedPointIndex : null;

  // Current ratio
  const currentRatio = ratioOverride || ratioPattern[ratioIndex % ratioPattern.length];

  // Displayed ratio for this view
  const displayRatio = useMemo(() => {
    if (isPastPoint) {
      const lineup = points[selectedPointIndex]?.lineup || [];
      const lineupPlayers = lineup.map(id => players.find(p => p.id === id)).filter(Boolean);
      const bx = lineupPlayers.filter(p => p.gender === 'bx').length;
      const gx = lineupPlayers.filter(p => p.gender === 'gx').length;
      return { bx, gx };
    }
    if (isFuturePoint) {
      if (overrideRatioForFuture) return overrideRatioForFuture;
      const preview = futureLineups.find(f => f.pointNumber - 1 === selectedPointIndex);
      return preview?.ratio || currentRatio;
    }
    return currentRatio;
  }, [isPastPoint, isFuturePoint, selectedPointIndex, points, players, futureLineups, currentRatio, overrideRatioForFuture]);

  // Bench-time warnings: on-field players with more playing time than the least-played bench player
  const lineupWarnings = useMemo(() => {
    if (!isCurrentPoint || phase !== 'pre-point' || benchPlayerIds.length === 0) return {};
    const warnings = {};
    const benchMetrics = benchPlayerIds.map(id => {
      const s = getDetailedPlayerStats(id, points, now);
      return equalizeBy === 'time' ? s.totalPlayingTimeMs : s.pointsPlayed;
    });
    const minBenchMetric = Math.min(...benchMetrics);
    displayLineupIds.forEach(id => {
      const s = getDetailedPlayerStats(id, points, now);
      const metric = equalizeBy === 'time' ? s.totalPlayingTimeMs : s.pointsPlayed;
      if (metric > minBenchMetric) {
        warnings[id] = true;
      }
    });
    return warnings;
  }, [isCurrentPoint, phase, displayLineupIds, benchPlayerIds, points, now, equalizeBy]);

  // Least played set — used to show a subtle indicator on player rows
  const leastPlayedIds = useMemo(() => {
    if (points.length < 3 || !isCurrentPoint) return new Set();
    const allIds = [...checkedInPlayerIds].filter(id => !unavailablePlayerIds.includes(id));
    const metrics = allIds.map(id => {
      const s = getDetailedPlayerStats(id, points, now);
      return equalizeBy === 'time' ? s.totalPlayingTimeMs : s.pointsPlayed;
    });
    const min = Math.min(...metrics);
    return new Set(allIds.filter((id, i) => metrics[i] === min));
  }, [points, checkedInPlayerIds, unavailablePlayerIds, equalizeBy, isCurrentPoint, now]);

  // Unavailable players list (only for current point view)
  const unavailablePlayerList = useMemo(() => {
    if (!isCurrentPoint) return [];
    return unavailablePlayerIds.filter(id => players.some(p => p.id === id));
  }, [isCurrentPoint, unavailablePlayerIds, players]);

  function handleMoveToField(playerId) {
    if (phase !== 'pre-point' && phase !== 'timeout-sub') return;
    const newOnField = [...onField, playerId];
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
  }

  function handleMoveToBench(playerId) {
    if (phase !== 'pre-point' && phase !== 'timeout-sub') return;
    const newOnField = onField.filter(id => id !== playerId);
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
  }

  function handleSitPlayer(playerId) {
    if (phase !== 'pre-point') return;
    const newOnField = onField.filter(id => id !== playerId);
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
    onSitPlayer?.(playerId);
  }

  function handleUnsitPlayer(playerId) {
    if (phase !== 'pre-point') return;
    onUnsitPlayer?.(playerId);
    const newOnField = [...onField, playerId];
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
  }

  function handleRatioTap() {
    if (isFuturePoint) {
      setShowRatioModal(true);
      return;
    }
    if (!isCurrentPoint || (phase !== 'pre-point' && phase !== 'timeout-sub')) return;
    const currentIdx = RATIO_OPTIONS.findIndex(
      r => r.bx === currentRatio.bx && r.gx === currentRatio.gx
    );
    const nextIdx = (currentIdx + 1) % RATIO_OPTIONS.length;
    const newRatio = RATIO_OPTIONS[nextIdx];
    dispatch({ type: ACTIONS.OVERRIDE_RATIO, ratio: newRatio });
    const availableIds = checkedInPlayerIds.filter(id => !sittingOutIds.has(id));
    const suggested = suggestLineup(players, availableIds, newRatio, points, equalizeBy);
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: suggested });
  }

  function handleAddStat(pointIndex, playerId, statType) {
    dispatch({
      type: ACTIONS.ADD_POINT_STAT,
      pointIndex: pointIndex === null ? gameState.points.length : pointIndex,
      playerId,
      statType,
    });
  }

  function handleRemoveStat(pointIndex, playerId, statType) {
    dispatch({
      type: ACTIONS.REMOVE_POINT_STAT,
      pointIndex: pointIndex === null ? gameState.points.length : pointIndex,
      playerId,
      statType,
    });
  }

  function handleEditScoredBy(scoredBy) {
    if (!isPastPoint || !editingPastPoint) return;
    dispatch({
      type: ACTIONS.EDIT_POINT_SCORED_BY,
      pointIndex: selectedPointIndex,
      scoredBy,
    });
  }

  // Toggle a player in/out of the edited past-point lineup
  function handleTogglePastPointPlayer(playerId) {
    if (!editingPastPoint || editedLineup === null) return;
    const isInLineup = editedLineup.includes(playerId);
    const newLineup = isInLineup
      ? editedLineup.filter(id => id !== playerId)
      : [...editedLineup, playerId];
    setEditedLineup(newLineup);
    dispatch({ type: ACTIONS.EDIT_POINT_LINEUP, pointIndex: selectedPointIndex, lineup: newLineup });
  }

  const [statModalPlayerId, setStatModalPlayerId] = useState(null);

  function countStatsForPlayer(statsArray, playerId) {
    const counts = { D: 0, assist: 0, goal: 0 };
    for (const s of statsArray) {
      if (s.playerId === playerId && counts[s.type] !== undefined) {
        counts[s.type]++;
      }
    }
    return counts;
  }

  function getAccumulatedStatCounts(playerId, allPoints, currentPointStats) {
    const counts = { D: 0, assist: 0, goal: 0 };
    for (const pt of (allPoints || [])) {
      for (const s of (pt.stats || [])) {
        if (s.playerId === playerId && counts[s.type] !== undefined) {
          counts[s.type]++;
        }
      }
    }
    for (const s of (currentPointStats || [])) {
      if (s.playerId === playerId && counts[s.type] !== undefined) {
        counts[s.type]++;
      }
    }
    return counts;
  }

  const canMove = isCurrentPoint && phase === 'pre-point';
  const canMoveTimeoutSub = isCurrentPoint && phase === 'timeout-sub';
  const contentOpacity = isFuturePoint ? 'opacity-60' : '';

  // Players eligible to appear in the past-point lineup editor
  const pastPointEditablePlayers = useMemo(() => {
    if (!editingPastPoint || !isPastPoint) return [];
    return players.filter(p => checkedInPlayerIds.includes(p.id));
  }, [editingPastPoint, isPastPoint, players, checkedInPlayerIds]);

  // Edit mode bench: checked-in players NOT in editedLineup
  const editModeBenchIds = useMemo(() => {
    if (!editingPastPoint || editedLineup === null) return [];
    const lineupSet = new Set(editedLineup);
    return checkedInPlayerIds.filter(id => !lineupSet.has(id));
  }, [editingPastPoint, editedLineup, checkedInPlayerIds]);

  // View mode past-point bench: checked-in players NOT in the point's lineup
  const pastPointBenchIds = useMemo(() => {
    if (!isPastPoint || editingPastPoint) return [];
    const lineupSet = new Set(points[selectedPointIndex]?.lineup || []);
    return checkedInPlayerIds.filter(id => !lineupSet.has(id));
  }, [isPastPoint, editingPastPoint, selectedPointIndex, points, checkedInPlayerIds]);

  function handleEditMoveToField(playerId) {
    if (editedLineup === null) return;
    const newLineup = [...editedLineup, playerId];
    setEditedLineup(newLineup);
    dispatch({ type: ACTIONS.EDIT_POINT_LINEUP, pointIndex: selectedPointIndex, lineup: newLineup });
  }

  function handleEditMoveToBench(playerId) {
    if (editedLineup === null) return;
    const newLineup = editedLineup.filter(id => id !== playerId);
    setEditedLineup(newLineup);
    dispatch({ type: ACTIONS.EDIT_POINT_LINEUP, pointIndex: selectedPointIndex, lineup: newLineup });
  }

  return (
    <div>
      {/* Ratio badge + equalizer toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleRatioTap}
          disabled={!canMove && !canMoveTimeoutSub && !isFuturePoint}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            canMove || canMoveTimeoutSub || isFuturePoint
              ? 'bg-gold/20 text-gold border border-gold/40 active:bg-gold/30 cursor-pointer'
              : 'bg-navy-800 text-navy-300 border border-navy-700 cursor-default'
          }`}
          style={{ minHeight: 36 }}
        >
          <span>{displayRatio.bx}bx / {displayRatio.gx}gx</span>
          {(canMove || canMoveTimeoutSub || isFuturePoint) && <span className="text-xs opacity-60">tap to change</span>}
        </button>

        {/* Equalizer toggle — only on current point */}
        {isCurrentPoint && (
          <button
            onClick={() =>
              dispatch({
                type: ACTIONS.SET_EQUALIZE,
                equalizeBy: equalizeBy === 'points' ? 'time' : 'points',
              })
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-navy-700 text-navy-200 border border-navy-600 active:bg-navy-600 transition-colors"
            style={{ minHeight: 36 }}
            title="Toggle equalization mode"
          >
            <span>⚖</span>
            <span>{equalizeBy === 'points' ? 'Points' : 'Time'}</span>
          </button>
        )}

        {isPastPoint && !editingPastPoint && (
          <span className="text-xs text-navy-400 italic">Past point</span>
        )}
        {isPastPoint && !editingPastPoint && (
          <button
            onClick={() => setShowEditConfirm(true)}
            className="text-xs font-semibold text-gold/70 active:text-gold px-2 py-1 rounded-lg border border-gold/30 active:border-gold/60 transition-colors"
            style={{ minHeight: 32 }}
          >
            Edit Lineup
          </button>
        )}
        {isPastPoint && editingPastPoint && (
          <span className="text-xs text-gold font-semibold italic">Editing lineup</span>
        )}
        {isPastPoint && editingPastPoint && (
          <button
            onClick={() => setEditingPastPoint(false)}
            className="text-xs font-semibold text-navy-300 active:text-white px-2 py-1 rounded-lg border border-navy-600 active:border-navy-400 transition-colors"
            style={{ minHeight: 32 }}
          >
            Done
          </button>
        )}
        {isFuturePoint && (
          <span className="text-xs text-navy-400 italic">Preview lineup</span>
        )}
      </div>

      {/* Direction / pull info for this point */}
      {(isCurrentPoint || isPastPoint) && (() => {
        const idx = isPastPoint ? selectedPointIndex : gameState.points.length;
        const info = getPointFlipInfo(idx, gameState);
        if (!info.direction && !info.puller) return null;
        return (
          <div className="flex items-center gap-2 mb-3 text-xs text-navy-400">
            {info.direction && (
              <>
                <span className="font-display text-lg text-gold leading-none">
                  {info.direction === 'right' ? '→' : '←'}
                </span>
                <span>Marmots attack {info.direction}</span>
              </>
            )}
            {info.puller && (
              <span>
                · {info.puller === 'us' ? 'Marmots pull' : `${gameState.opponent} pulls`}
              </span>
            )}
            {gameState.halftimeAfterPointCount != null &&
             idx >= gameState.halftimeAfterPointCount &&
             isPastPoint && (
              <span className="text-navy-600">· 2nd half</span>
            )}
          </div>
        );
      })()}

      {/* On Field section */}
      <div className={contentOpacity}>
        <div className="flex items-center gap-2 mb-2">
          {isFuturePoint ? (
            <span className="text-xs uppercase text-navy-300 font-semibold italic">
              {overrideRatioForFuture
                ? `Projected Lineup (override: ${overrideRatioForFuture.bx}bx/${overrideRatioForFuture.gx}gx)`
                : `Projected Lineup (${displayRatio.bx}bx/${displayRatio.gx}gx)`
              } ({displayLineupIds.length})
            </span>
          ) : (
            <span className="text-xs uppercase text-navy-300 font-semibold">
              On Field ({displayLineupIds.length})
            </span>
          )}
        </div>

        {/* Scored-by edit toggle — only in past point edit mode */}
        {isPastPoint && editingPastPoint && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-navy-400">Scored by:</span>
            <button
              onClick={() => handleEditScoredBy('us')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                points[selectedPointIndex]?.scoredBy === 'us'
                  ? 'bg-score-green text-white'
                  : 'bg-navy-700 text-navy-300 active:bg-navy-600'
              }`}
              style={{ minHeight: 32 }}
            >
              Us
            </button>
            <button
              onClick={() => handleEditScoredBy('them')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                points[selectedPointIndex]?.scoredBy === 'them'
                  ? 'bg-score-red text-white'
                  : 'bg-navy-700 text-navy-300 active:bg-navy-600'
              }`}
              style={{ minHeight: 32 }}
            >
              Them
            </button>
          </div>
        )}

        {/* Past point lineup editor — pre-point picker style with two sections */}
        {isPastPoint && editingPastPoint ? (
          <div>
            {(editedLineup || []).map(id => {
              const player = players.find(p => p.id === id);
              if (!player) return null;
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={true}
                  onMove={() => handleEditMoveToBench(id)}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                />
              );
            })}
            {(editedLineup || []).length === 0 && (
              <div className="text-xs text-navy-400 py-4 text-center">No players on field — tap + below to add</div>
            )}
          </div>
        ) : (
          <div>
            {displayLineupIds.map(id => {
              const player = players.find(p => p.id === id);
              const stats = getDetailedPlayerStats(id, points, now);
              const statCounts =
                isCurrentPoint
                  ? getAccumulatedStatCounts(id, gameState.points, gameState.currentStats)
                  : countStatsForPlayer(viewedStats, id);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={true}
                  onMove={
                    canMove ? () => handleSitPlayer(id)
                    : canMoveTimeoutSub ? () => handleMoveToBench(id)
                    : (isCurrentPoint && phase === 'playing') ? () => setSwappingOutId(swappingOutId === id ? null : id)
                    : null
                  }
                  moveBtnLabel={
                    canMove ? 'SIT'
                    : (isCurrentPoint && phase === 'playing') ? (swappingOutId === id ? '✕' : 'SWAP')
                    : null
                  }
                  disabled={!canMove && !canMoveTimeoutSub && !(isCurrentPoint && phase === 'playing')}
                  statCounts={statCounts}
                  onStatTap={((isCurrentPoint && phase === 'playing') || (isPastPoint && !editingPastPoint)) ? () => setStatModalPlayerId(id) : undefined}
                  onNameTap={isCurrentPoint ? () => setInfoModalPlayerId(id) : undefined}
                  hideStatBadges={isCurrentPoint}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                  isLeastPlayed={leastPlayedIds.has(id)}
                  hasWarning={!!(lineupWarnings && lineupWarnings[id])}
                />
              );
            })}
            {displayLineupIds.length === 0 && (
              <div className="text-xs text-navy-400 py-4 text-center">No players on field yet</div>
            )}
          </div>
        )}
      </div>

      {/* Edit mode bench section */}
      {isPastPoint && editingPastPoint && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs uppercase text-navy-400 font-semibold">Bench</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>
          <div>
            {editModeBenchIds.map(id => {
              const player = players.find(p => p.id === id);
              if (!player) return null;
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={false}
                  onMove={() => handleEditMoveToField(id)}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                />
              );
            })}
            {editModeBenchIds.length === 0 && (
              <div className="text-xs text-navy-400 py-2 text-center">All players on field</div>
            )}
          </div>
        </>
      )}

      {/* Bench section — only shown for current point */}
      {isCurrentPoint && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs uppercase text-navy-400 font-semibold">Bench</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>

          <div>
            {benchPlayerIds.filter(id => !sittingOutIds.has(id)).map(id => {
              const player = players.find(p => p.id === id);
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={false}
                  onMove={
                    (canMove || canMoveTimeoutSub) ? () => handleMoveToField(id)
                    : (swappingOutId && isCurrentPoint && phase === 'playing') ? () => {
                        dispatch({ type: ACTIONS.MID_POINT_SUB, outId: swappingOutId, inId: id });
                        setSwappingOutId(null);
                      }
                    : null
                  }
                  moveBtnLabel={
                    swappingOutId && isCurrentPoint && phase === 'playing' ? 'IN' : null
                  }
                  disabled={!canMove && !canMoveTimeoutSub && !(swappingOutId && isCurrentPoint && phase === 'playing')}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  onInfoTap={() => setInfoModalPlayerId(id)}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                  isLeastPlayed={leastPlayedIds.has(id)}
                />
              );
            })}
            {benchPlayerIds.filter(id => !sittingOutIds.has(id)).length === 0 &&
             benchPlayerIds.filter(id => sittingOutIds.has(id)).length === 0 && (
              <div className="text-xs text-navy-400 py-2 text-center">No players on bench</div>
            )}
          </div>

          {/* Sitting out this point */}
          {benchPlayerIds.some(id => sittingOutIds.has(id)) && (
            <>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-amber-400/20" />
                <span className="text-xs uppercase text-amber-400/70 font-semibold">Sitting out this point</span>
                <div className="flex-1 h-px bg-amber-400/20" />
              </div>
              <div>
                {benchPlayerIds.filter(id => sittingOutIds.has(id)).map(id => {
                  const player = players.find(p => p.id === id);
                  const stats = getDetailedPlayerStats(id, points, now);
                  return (
                    <LineupPlayerRow
                      key={id}
                      player={player}
                      pointsPlayed={stats.pointsPlayed}
                      totalPlayingTimeMs={stats.totalPlayingTimeMs}
                      benchTimeMs={stats.benchTimeMs}
                      lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                      isOnField={false}
                      isSittingOut={true}
                      onMove={canMove ? () => handleUnsitPlayer(id) : null}
                      disabled={!canMove}
                      statCounts={{ D: 0, assist: 0, goal: 0 }}
                      onInfoTap={() => setInfoModalPlayerId(id)}
                      equalizeBy={equalizeBy}
                      pointsSinceLastPlay={stats.pointsSinceLastPlay}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Late arrivals — not checked in at game start, tap to add to bench */}
          {checkedOutPlayerIds.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px bg-navy-800" />
                <span className="text-[10px] uppercase text-navy-600 font-semibold tracking-wide">Not present</span>
                <div className="flex-1 h-px bg-navy-800" />
              </div>
              <div className="flex flex-wrap gap-2">
                {checkedOutPlayerIds.map(id => {
                  const player = players.find(p => p.id === id);
                  if (!player) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => dispatch({ type: ACTIONS.CHECK_IN_PLAYER, playerId: id })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-800 border border-navy-700 active:border-navy-500 active:bg-navy-700 transition-colors"
                      style={{ minHeight: 36 }}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                      <span className="text-xs text-navy-300 font-medium">{player.name}</span>
                      <span className="text-[10px] text-navy-500">+</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Past point bench section — players who weren't in the lineup */}
      {isPastPoint && !editingPastPoint && pastPointBenchIds.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs uppercase text-navy-400 font-semibold">Bench</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>
          <div>
            {pastPointBenchIds.map(id => {
              const player = players.find(p => p.id === id);
              if (!player) return null;
              const stats = getDetailedPlayerStats(id, points, now);
              const statCounts = countStatsForPlayer(viewedStats, id);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={false}
                  statCounts={statCounts}
                  onStatTap={() => setStatModalPlayerId(id)}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Unavailable players section — only for current point */}
      {isCurrentPoint && unavailablePlayerList.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs uppercase text-score-red/70 font-semibold">Unavailable</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>
          <div>
            {unavailablePlayerList.map(id => {
              const player = players.find(p => p.id === id);
              if (!player) return null;
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  lastPlayedGameMinute={gameMinute(stats.lastPointEndedAt)}
                  isOnField={false}
                  onMove={null}
                  disabled={true}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  isUnavailable={true}
                  onInfoTap={() => setInfoModalPlayerId(id)}
                  equalizeBy={equalizeBy}
                  pointsSinceLastPlay={stats.pointsSinceLastPlay}
                />
              );
            })}
          </div>
        </>
      )}

      {statModalPlayerId && (
        <PlayerStatModal
          player={players.find(p => p.id === statModalPlayerId)}
          pointIndex={selectedPointIndex}
          stats={(selectedPointIndex === null ? gameState.currentStats : gameState.points[selectedPointIndex]?.stats || [])
            .filter(s => s.playerId === statModalPlayerId)}
          onAddStat={handleAddStat}
          onRemoveStat={handleRemoveStat}
          onClose={() => setStatModalPlayerId(null)}
        />
      )}

      {/* Player info modal */}
      {infoModalPlayerId && (
        <PlayerInfoModal
          player={players.find(p => p.id === infoModalPlayerId)}
          gameState={gameState}
          onMarkUnavailable={(playerId) => dispatch({ type: ACTIONS.MARK_UNAVAILABLE, playerId })}
          onMarkAvailable={(playerId) => dispatch({ type: ACTIONS.MARK_AVAILABLE, playerId })}
          onClose={() => setInfoModalPlayerId(null)}
        />
      )}

      {/* Edit confirmation modal */}
      {showEditConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onClick={() => setShowEditConfirm(false)}
        >
          <div
            className="bg-navy-800 rounded-xl p-5 max-w-sm mx-4 w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gold">Edit lineup for this point?</p>
            <p className="text-xs text-navy-300 leading-relaxed">
              Adjust who was on the field for this point. To add or change stats, tap any player's + button from the normal view.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowEditConfirm(false)} className="btn-primary flex-1" style={{ minHeight: 44 }}>
                Cancel
              </button>
              <button
                onClick={() => { setEditingPastPoint(true); setShowEditConfirm(false); }}
                className="btn-gold flex-1"
                style={{ minHeight: 44 }}
              >
                Yes, Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ratio picker modal — only for future points */}
      {showRatioModal && isFuturePoint && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onClick={() => setShowRatioModal(false)}
        >
          <div
            className="bg-navy-800 rounded-xl p-4 max-w-sm mx-4 w-full space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gold mb-3">Select Gender Ratio</p>
            {RATIO_PRESETS.map(ratio => (
              <button
                key={`${ratio.bx}/${ratio.gx}`}
                onClick={() => {
                  setOverrideRatioForFuture(ratio);
                  setShowRatioModal(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform ${
                  displayRatio.bx === ratio.bx && displayRatio.gx === ratio.gx
                    ? 'bg-gold text-navy-950'
                    : 'bg-navy-700 text-white active:bg-navy-600'
                }`}
              >
                {ratio.bx}bx / {ratio.gx}gx
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
