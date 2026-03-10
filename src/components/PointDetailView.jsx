import { useMemo } from 'react';
import { ACTIONS } from '../context/GameContext';
import { getDetailedPlayerStats, suggestLineup } from '../utils/lineup';
import LineupPlayerRow from './LineupPlayerRow';
import StatAttribution from './StatAttribution';

const RATIO_OPTIONS = [
  { bx: 4, gx: 1 },
  { bx: 3, gx: 2 },
  { bx: 2, gx: 3 },
  { bx: 1, gx: 4 },
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
  } = gameState;

  // Determine what we're viewing
  const isPastPoint = selectedPointIndex !== null && selectedPointIndex < points.length;
  const isFuturePoint = selectedPointIndex !== null && selectedPointIndex >= points.length;
  const isCurrentPoint = selectedPointIndex === null;

  // Current point is at index === points.length (0-based)
  const currentPointIndex = points.length;

  // Resolve the lineup to display
  const displayLineupIds = useMemo(() => {
    if (isPastPoint) {
      return points[selectedPointIndex]?.lineup || [];
    }
    if (isFuturePoint) {
      const preview = futureLineups.find(f => f.pointNumber - 1 === selectedPointIndex);
      return preview?.lineup || [];
    }
    // Current point
    return onField;
  }, [isPastPoint, isFuturePoint, selectedPointIndex, points, futureLineups, onField]);

  // Bench players for current point (sorted by bench time desc)
  const now = Date.now();
  const benchPlayerIds = useMemo(() => {
    if (!isCurrentPoint) return [];
    const onFieldSet = new Set(displayLineupIds);
    const bench = checkedInPlayerIds.filter(id => !onFieldSet.has(id));
    return bench.sort((a, b) => {
      const sa = getDetailedPlayerStats(a, points, now);
      const sb = getDetailedPlayerStats(b, points, now);
      return sb.benchTimeMs - sa.benchTimeMs;
    });
  }, [isCurrentPoint, displayLineupIds, checkedInPlayerIds, points, now]);

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
      const preview = futureLineups.find(f => f.pointNumber - 1 === selectedPointIndex);
      return preview?.ratio || currentRatio;
    }
    return currentRatio;
  }, [isPastPoint, isFuturePoint, selectedPointIndex, points, players, futureLineups, currentRatio]);

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
    dispatch({ type: ACTIONS.ADD_POINT_STAT, pointIndex, playerId, statType });
  }

  function handleRemoveStat(pointIndex, playerId, statType) {
    dispatch({ type: ACTIONS.REMOVE_POINT_STAT, pointIndex, playerId, statType });
  }

  const canMove = isCurrentPoint && phase === 'pre-point';
  const contentOpacity = isFuturePoint ? 'opacity-60' : '';

  return (
    <div>
      {/* Ratio badge */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleRatioTap}
          disabled={!canMove}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            canMove
              ? 'bg-gold/20 text-gold border border-gold/40 active:bg-gold/30'
              : 'bg-navy-800 text-navy-300 border border-navy-700 cursor-default'
          }`}
          style={{ minHeight: 36 }}
        >
          <span>{displayRatio.bx}bx / {displayRatio.gx}gx</span>
          {canMove && <span className="text-xs opacity-60">tap to change</span>}
        </button>
        {isPastPoint && (
          <span className="text-xs text-navy-400 italic">Past point (read-only)</span>
        )}
        {isFuturePoint && (
          <span className="text-xs text-navy-400 italic">Preview lineup</span>
        )}
      </div>

      {/* On Field section */}
      <div className={contentOpacity}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase text-navy-300 font-semibold">
            On Field ({displayLineupIds.length})
          </span>
        </div>

        <div>
          {displayLineupIds.map(id => {
            const player = players.find(p => p.id === id);
            const stats = getDetailedPlayerStats(id, points, now);
            const pointStats = viewedStats.filter(s => s.playerId === id);
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
                stats={pointStats}
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
                  stats={[]}
                />
              );
            })}
            {benchPlayerIds.length === 0 && (
              <div className="text-xs text-navy-400 py-2 text-center">No players on bench</div>
            )}
          </div>
        </>
      )}

      {/* Stat attribution — shown for current and past points, not future */}
      {!isFuturePoint && (
        <StatAttribution
          pointIndex={statPointIndex}
          stats={viewedStats}
          lineupPlayerIds={displayLineupIds}
          players={players}
          onAddStat={handleAddStat}
          onRemoveStat={handleRemoveStat}
          editable={isCurrentPoint || isPastPoint}
        />
      )}
    </div>
  );
}
