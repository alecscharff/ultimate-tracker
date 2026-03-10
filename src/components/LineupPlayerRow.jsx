function formatBenchTime(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return null;
  const minutes = Math.round(milliseconds / 60000);
  if (minutes < 1) return null;
  return `last ${minutes}m ago`;
}

export default function LineupPlayerRow({
  player,
  pointsPlayed,
  totalPlayingTimeMs,
  benchTimeMs,
  lastPlayedGameMinute,
  isOnField,
  onMove,
  disabled,
  statCounts = { D: 0, assist: 0, goal: 0 },
  onStatTap,
  onCheckInToggle,
  isCheckedIn,
  hasWarning,
  onInfoTap,
  isUnavailable,
}) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500';
  // Show game-relative "last at Xm" if available, otherwise fall back to wall-clock "last Xm ago"
  const benchLabel = lastPlayedGameMinute !== null && lastPlayedGameMinute !== undefined
    ? `last at ${lastPlayedGameMinute}m`
    : formatBenchTime(benchTimeMs);
  const totalMinutes = totalPlayingTimeMs ? Math.round(totalPlayingTimeMs / 60000) : null;
  const rowOpacity = (onCheckInToggle !== undefined && !isCheckedIn) || isUnavailable ? 'opacity-40' : '';
  const warningBorder = hasWarning ? 'border-l-2 border-yellow-500' : '';

  return (
    <div className={`bg-navy-800 rounded-lg px-3 py-2 mb-1 flex items-center gap-2 min-h-[52px] ${rowOpacity} ${warningBorder}`}>
      {/* Gender dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${genderColor}`} />

      {/* Name + grade */}
      <div className="flex items-center gap-1.5 min-w-0" style={{ flex: '1 1 0' }}>
        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
        <span className="text-xs text-navy-300 flex-shrink-0">G{player.grade}</span>
      </div>

      {/* Right section: stat badges + time info */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* Top row: stat badges */}
        <div className="flex items-center gap-1">
          {statCounts.D > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
              D {statCounts.D}
            </span>
          )}
          {statCounts.assist > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500 text-navy-950">
              A {statCounts.assist}
            </span>
          )}
          {statCounts.goal > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">
              G {statCounts.goal}
            </span>
          )}
        </div>
        {/* Bottom row: combined stat line */}
        <div className="flex items-center gap-1 text-[11px] text-navy-400">
          <span>{pointsPlayed} pts</span>
          {totalMinutes !== null && (
            <>
              <span className="text-navy-600">|</span>
              <span>{totalMinutes}m played</span>
            </>
          )}
          {benchLabel && (
            <>
              <span className="text-navy-600">|</span>
              <span>{benchLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Stat edit button — only if onStatTap provided */}
      {onStatTap && (
        <button
          onClick={onStatTap}
          className="flex-shrink-0 text-navy-400 active:text-gold text-base leading-none flex items-center justify-center rounded-lg transition-colors"
          style={{ minHeight: 36, minWidth: 36 }}
          title="Edit stats"
        >
          +
        </button>
      )}

      {/* Info button */}
      {onInfoTap && (
        <button
          onClick={onInfoTap}
          className="flex-shrink-0 text-navy-400 active:text-gold text-xs font-bold leading-none flex items-center justify-center rounded-full border border-navy-600 active:border-gold transition-colors"
          style={{ minHeight: 28, minWidth: 28 }}
          title="Player info"
        >
          i
        </button>
      )}

      {/* Check-in toggle — only rendered for bench rows during current point */}
      {onCheckInToggle !== undefined && (
        <button
          onClick={onCheckInToggle}
          className="flex-shrink-0 flex items-center justify-center rounded-lg text-lg leading-none text-navy-300 active:bg-navy-700 transition-colors"
          style={{ minHeight: 36, minWidth: 36 }}
          title={isCheckedIn ? 'Check out' : 'Check in'}
        >
          {isCheckedIn ? '✓' : '○'}
        </button>
      )}

      {/* Move button */}
      {onMove && (
        <button
          onClick={onMove}
          disabled={disabled}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-lg text-navy-300 active:bg-navy-700 disabled:opacity-30 transition-colors"
          style={{ minWidth: 36, minHeight: 36 }}
        >
          {isOnField ? '↓' : '↑'}
        </button>
      )}
    </div>
  );
}
