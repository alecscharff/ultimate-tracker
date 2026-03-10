function formatBenchTime(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return null;
  // Round to nearest 5 minutes
  const minutes = Math.round(milliseconds / 60000 / 5) * 5;
  if (minutes === 0) return null; // Don't show if < 2.5 min
  return `${minutes}m since last played`;
}

export default function LineupPlayerRow({
  player,
  pointsPlayed,
  totalPlayingTimeMs,
  benchTimeMs,
  isOnField,
  onMove,
  disabled,
  statCounts = { D: 0, assist: 0, goal: 0 },
  onStatTap,
  onCheckInToggle,
  isCheckedIn,
}) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500';
  const benchLabel = !isOnField ? formatBenchTime(benchTimeMs) : null;
  const totalMinutes = totalPlayingTimeMs ? Math.round(totalPlayingTimeMs / 60000) : null;
  const rowOpacity = onCheckInToggle !== undefined && !isCheckedIn ? 'opacity-40' : '';

  return (
    <div className={`bg-navy-800 rounded-lg px-3 py-2 mb-1 flex items-center gap-2 min-h-[52px] ${rowOpacity}`}>
      {/* Gender dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${genderColor}`} />

      {/* Name + grade */}
      <div className="flex items-center gap-1.5 min-w-0" style={{ flex: '1 1 0' }}>
        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
        <span className="text-xs text-navy-300 flex-shrink-0">G{player.grade}</span>
      </div>

      {/* Right section: stat badges + time info */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* Top row: points played + stat badges */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-navy-300">{pointsPlayed} pts</span>

          {/* Stat badges — only render if count > 0 */}
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

        {/* Bottom row: bench time + total played */}
        {(benchLabel || totalMinutes) && (
          <div className="flex items-center gap-1 text-xs text-navy-400">
            {benchLabel && <span className="truncate">{benchLabel}</span>}
            {benchLabel && totalMinutes && <span>|</span>}
            {totalMinutes && <span>{totalMinutes}m total</span>}
          </div>
        )}
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
