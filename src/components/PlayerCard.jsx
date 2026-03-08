const STAT_LABELS = {
  greatThrow: 'Throw',
  d: 'D',
  assist: 'Ast',
  score: 'Goal',
};

export default function PlayerCard({ player, stats, isOnField, onTap, onStat, showStats, compact }) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600';

  return (
    <div
      onClick={onTap}
      className={`card p-3 transition-all duration-150 ${
        isOnField
          ? 'border-gold bg-navy-800 ring-1 ring-gold/30'
          : 'border-navy-700 bg-navy-800/60 active:bg-navy-700'
      } ${onTap ? 'cursor-pointer' : ''} ${compact ? 'p-2' : ''}`}
      style={{ minHeight: '44px' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-white truncate text-[15px]">{player.name}</span>
          <span className={`${genderColor} text-[11px] font-bold uppercase px-1.5 py-0.5 rounded`}>
            {player.gender}
          </span>
          <span className="text-[11px] text-navy-300 font-mono">G{player.grade}</span>
        </div>
        {stats && (
          <div className="text-right text-xs text-navy-300 whitespace-nowrap">
            <span>{stats.pointsPlayed}pt</span>
            {stats.lastPointNumber >= 0 && (
              <span className="text-navy-400 ml-1">#{stats.lastPointNumber + 1}</span>
            )}
          </div>
        )}
      </div>

      {showStats && isOnField && onStat && (
        <div className="flex gap-1.5 mt-2">
          {Object.entries(STAT_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={e => {
                e.stopPropagation();
                onStat(player.id, type);
              }}
              className="flex-1 text-xs font-semibold py-2.5 rounded-lg bg-navy-700 text-navy-200
                active:bg-navy-600 active:text-white transition-colors"
              style={{ minHeight: '44px' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
