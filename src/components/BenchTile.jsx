export default function BenchTile({
  player,
  pointsPlayed,
  totalPlayingTimeMs,
  pointsSinceLastPlay,
  isLeastPlayed,
  hasWarning,
  onMove,
  moveBtnLabel,
  disabled,
  onInfoTap,
  equalizeBy,
  isSittingOut,
  onStatTap,
}) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500';
  const borderClass = hasWarning
    ? 'border-l-2 border-yellow-500'
    : isLeastPlayed
    ? 'border-l-2 border-teal-500/60'
    : '';
  const totalMinutes = totalPlayingTimeMs ? Math.round(totalPlayingTimeMs / 60000) : null;

  function renderStatInfo() {
    if (equalizeBy === 'time') {
      return <span>{totalMinutes ?? 0}m</span>;
    }
    const sinceLast = pointsSinceLastPlay ?? null;
    return (
      <span>
        {pointsPlayed}pt{pointsPlayed !== 1 ? 's' : ''}
        {pointsPlayed > 0 && sinceLast !== null && sinceLast > 0 && (
          <span className="text-navy-500"> · {sinceLast}ago</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`bg-navy-800 rounded-lg p-2 flex flex-col gap-1 min-h-[68px] ${borderClass} ${onStatTap ? 'active:bg-navy-700/80 cursor-pointer select-none' : ''}`}
      onClick={onStatTap || undefined}
    >
      {/* Name row */}
      <div className="flex items-center gap-1 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${genderColor}`} />
        <span className="text-sm font-semibold text-white truncate flex-1 min-w-0">{player.name}</span>
        <span className="text-[10px] text-navy-500 flex-shrink-0">G{player.grade}</span>
        {onInfoTap && (
          <button
            onClick={e => { e.stopPropagation(); onInfoTap(); }}
            className="flex-shrink-0 text-navy-600 active:text-gold text-[10px] font-bold italic flex items-center justify-center rounded-full border border-navy-700 active:border-gold ml-0.5"
            style={{ minHeight: 18, minWidth: 18 }}
          >
            i
          </button>
        )}
      </div>

      {/* Stats line */}
      <div className="text-[11px] text-navy-400 pl-3 leading-tight">
        {renderStatInfo()}
      </div>

      {/* Action button — flush to bottom-right */}
      {onMove && (
        <div className="flex justify-end mt-auto pt-0.5">
          {moveBtnLabel ? (
            <button
              onClick={e => { e.stopPropagation(); onMove(); }}
              disabled={disabled}
              className="text-xs font-bold text-amber-400 border border-amber-400/50 active:bg-amber-400/20 disabled:opacity-30 rounded-lg px-2"
              style={{ minHeight: 28 }}
            >
              {moveBtnLabel}
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onMove(); }}
              disabled={disabled}
              className="text-navy-300 active:bg-navy-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-base"
              style={{ minHeight: 28, minWidth: 28 }}
            >
              ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}
