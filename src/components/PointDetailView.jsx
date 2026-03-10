import { useMemo, useState, useEffect } from 'react';
import { ACTIONS } from '../context/GameContext';
import { getDetailedPlayerStats, suggestLineup } from '../utils/lineup';
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

  // Past point edit state
  const [editingPastPoint, setEditingPastPoint] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  useEffect(() => {
    setEditingPastPoint(false);
    setShowEditConfirm(false);
  }, [selectedPointIndex]);

  // When viewing a future point, compute a projected lineup for the active override ratio
  const projectedLineup = useMemo(() => {
    if (!isFuturePoint || !overrideRatioForFuture) return null;
    return suggestLineup(players, checkedInPlayerIds, overrideRatioForFuture, points, equalizeBy);
  }, [isFuturePoint, overrideRatioForFuture, players, checkedInPlayerIds, points, equalizeBy]);

  // Resolve the lineup to display
  const displayLineupIds = useMemo(() => {
    if (isPastPoint) {
      return points[selectedPointIndex]?.lineup || [];
    }
    if (isFuturePoint) {
      // Override ratio preview takes priority over the default futureLineups entry
      if (overrideRatioForFuture && projectedLineup) return projectedLineup;
      const preview = futureLineups.find(f => f.pointNumber - 1 === selectedPointIndex);
      return preview?.lineup || [];
    }
    // Current point
    return onField;
  }, [isPastPoint, isFuturePoint, selectedPointIndex, points, futureLineups, onField, overrideRatioForFuture, projectedLineup]);

  // Bench players for current point (sorted by bench time desc)
  const now = Date.now();
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
      // Coach-selected override for preview takes priority
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

  // Unavailable players list (only for current point view)
  const unavailablePlayerList = useMemo(() => {
    if (!isCurrentPoint) return [];
    return unavailablePlayerIds.filter(id => players.some(p => p.id === id));
  }, [isCurrentPoint, unavailablePlayerIds, players]);

  function handleMoveToField(playerId) {
    if (phase !== 'pre-point') return;
    // Add this bench player to the field, keeping within ratio limits
    const newOnField = [...onField, playerId];
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
  }

  function handleMoveToBench(playerId) {
    if (phase !== 'pre-point') return;
    const newOnField = onField.filter(id => id !== playerId);
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: newOnField });
  }

  function handleRatioTap() {
    if (isFuturePoint) {
      setShowRatioModal(true);
      return;
    }
    if (!isCurrentPoint || phase !== 'pre-point') return;
    const currentIdx = RATIO_OPTIONS.findIndex(
      r => r.bx === currentRatio.bx && r.gx === currentRatio.gx
    );
    const nextIdx = (currentIdx + 1) % RATIO_OPTIONS.length;
    const newRatio = RATIO_OPTIONS[nextIdx];
    dispatch({ type: ACTIONS.OVERRIDE_RATIO, ratio: newRatio });
    const suggested = suggestLineup(players, checkedInPlayerIds, newRatio, points, equalizeBy);
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
  const contentOpacity = isFuturePoint ? 'opacity-60' : '';

  return (
    <div>
      {/* Ratio badge */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleRatioTap}
          disabled={!canMove && !isFuturePoint}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            canMove || isFuturePoint
              ? 'bg-gold/20 text-gold border border-gold/40 active:bg-gold/30 cursor-pointer'
              : 'bg-navy-800 text-navy-300 border border-navy-700 cursor-default'
          }`}
          style={{ minHeight: 36 }}
        >
          <span>{displayRatio.bx}bx / {displayRatio.gx}gx</span>
          {(canMove || isFuturePoint) && <span className="text-xs opacity-60">tap to change</span>}
        </button>
        {isPastPoint && !editingPastPoint && (
          <span className="text-xs text-navy-400 italic">Past point (read-only)</span>
        )}
        {isPastPoint && !editingPastPoint && (
          <button
            onClick={() => setShowEditConfirm(true)}
            className="text-xs font-semibold text-gold/70 active:text-gold px-2 py-1 rounded-lg border border-gold/30 active:border-gold/60 transition-colors"
            style={{ minHeight: 32 }}
          >
            Edit
          </button>
        )}
        {isPastPoint && editingPastPoint && (
          <span className="text-xs text-gold font-semibold italic">Editing past point</span>
        )}
        {isFuturePoint && (
          <span className="text-xs text-navy-400 italic">Preview lineup</span>
        )}
      </div>

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
                isOnField={true}
                onMove={canMove ? () => handleMoveToBench(id) : null}
                disabled={!canMove}
                statCounts={statCounts}
                onStatTap={(!isFuturePoint && (isCurrentPoint || editingPastPoint)) ? () => setStatModalPlayerId(id) : undefined}
                hasWarning={!!(lineupWarnings && lineupWarnings[id])}
                onInfoTap={isCurrentPoint ? () => setInfoModalPlayerId(id) : undefined}
              />
            );
          })}
          {displayLineupIds.length === 0 && (
            <div className="text-xs text-navy-400 py-4 text-center">No players on field yet</div>
          )}
        </div>
      </div>

      {/* Bench section — only shown for current point */}
      {isCurrentPoint && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs uppercase text-navy-400 font-semibold">Bench</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>

          <div>
            {benchPlayerIds.map(id => {
              const player = players.find(p => p.id === id);
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  isOnField={false}
                  onMove={canMove ? () => handleMoveToField(id) : null}
                  disabled={!canMove}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  isCheckedIn={true}
                  onCheckInToggle={() =>
                    dispatch({ type: ACTIONS.CHECK_OUT_PLAYER, playerId: id })
                  }
                  onInfoTap={() => setInfoModalPlayerId(id)}
                />
              );
            })}
            {checkedOutPlayerIds.map(id => {
              const player = players.find(p => p.id === id);
              const stats = getDetailedPlayerStats(id, points, now);
              return (
                <LineupPlayerRow
                  key={id}
                  player={player}
                  pointsPlayed={stats.pointsPlayed}
                  totalPlayingTimeMs={stats.totalPlayingTimeMs}
                  benchTimeMs={stats.benchTimeMs}
                  isOnField={false}
                  onMove={null}
                  disabled={true}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  isCheckedIn={false}
                  onCheckInToggle={() =>
                    dispatch({ type: ACTIONS.CHECK_IN_PLAYER, playerId: id })
                  }
                  onInfoTap={() => setInfoModalPlayerId(id)}
                />
              );
            })}
            {benchPlayerIds.length === 0 && checkedOutPlayerIds.length === 0 && (
              <div className="text-xs text-navy-400 py-2 text-center">No players on bench</div>
            )}
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
                  isOnField={false}
                  onMove={null}
                  disabled={true}
                  statCounts={{ D: 0, assist: 0, goal: 0 }}
                  isUnavailable={true}
                  onInfoTap={() => setInfoModalPlayerId(id)}
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
            <p className="text-sm font-semibold text-gold">Edit past point?</p>
            <p className="text-xs text-navy-300 leading-relaxed">
              This point is over. You can change who scored and edit player stats. Lineup changes are not supported.
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
