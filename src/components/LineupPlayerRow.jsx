function formatBenchTime(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function LineupPlayerRow({
  player,
  pointsPlayed,
  totalPlayingTimeMs,
  benchTimeMs,
  isOnField,
  onMove,
  disabled,
  stats,
}) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500';

  return (
    <div className="bg-navy-800 rounded-lg px-3 py-2 mb-1 flex items-center gap-2 min-h-[52px]">
      {/* Gender dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${genderColor}`} />

      {/* Name + grade */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
        <span className="text-xs text-navy-300 flex-shrink-0">G{player.grade}</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-navy-300">{pointsPlayed} pts</span>
        {!isOnField && (
          <span className="text-xs text-navy-300">{formatBenchTime(benchTimeMs)}</span>
        )}
        {stats && stats.length > 0 && (
          <div className="flex gap-1">
            {stats.map((s, i) => (
              <span
                key={i}
                className="text-[10px] font-bold px-1 py-0.5 rounded bg-navy-700 text-navy-300"
              >
                {s.type}
              </span>
            ))}
          </div>
        )}
      </div>

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
