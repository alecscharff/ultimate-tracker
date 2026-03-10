export default function SpectatorPlayerCard({
  player,
  isOnField,
  isSelected,
  coachStats,
  spectatorStats,
  onTap,
}) {
  if (!player) return null;

  const genderColor = player.gender === 'gx' ? 'bg-purple-500' : 'bg-blue-500';

  // Combine coach + spectator stats for display totals
  const totalGoals = (coachStats?.goals || 0) + (spectatorStats?.goals || 0);
  const totalAssists = (coachStats?.assists || 0) + (spectatorStats?.assists || 0);
  const totalDs = (coachStats?.ds || 0) + (spectatorStats?.ds || 0);
  const pointsPlayed = coachStats?.pointsPlayed || 0;

  const hasAnyStats = totalGoals > 0 || totalAssists > 0 || totalDs > 0;

  let containerClass =
    'bg-navy-800 rounded-lg px-3 py-2 mb-1 flex items-center gap-2 min-h-[52px] cursor-pointer active:bg-navy-700 transition-colors';

  if (isSelected) containerClass += ' ring-2 ring-gold';
  if (isOnField) containerClass += ' border-l-4 border-gold';
  if (!isOnField) containerClass += ' opacity-60';

  return (
    <div className={containerClass} onClick={onTap} role="button" tabIndex={0}>
      {/* Gender dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${genderColor}`} />

      {/* Name + grade */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
        <span className="text-xs text-navy-300 ml-1 flex-shrink-0">G{player.grade}</span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1 flex-shrink-0 text-xs">
        {hasAnyStats && (
          <>
            {totalGoals > 0 && (
              <span className="text-score-green font-semibold">{totalGoals}G</span>
            )}
            {totalAssists > 0 && (
              <span className="text-gold font-semibold">{totalAssists}A</span>
            )}
            {totalDs > 0 && (
              <span className="text-blue-400 font-semibold">{totalDs}D</span>
            )}
            <span className="text-navy-300 ml-0.5">· {pointsPlayed}pts</span>
          </>
        )}
        {!hasAnyStats && pointsPlayed > 0 && (
          <span className="text-navy-300">{pointsPlayed}pts</span>
        )}
      </div>
    </div>
  );
}
