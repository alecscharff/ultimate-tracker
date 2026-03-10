import { getDetailedPlayerStats, getPlayerStats } from '../utils/lineup';
import { getAggregatedPlayerStats } from '../utils/pointStats';

const GENDER_DOT_STYLES = {
  gx: 'bg-purple-500',
  bx: 'bg-blue-500',
};

export default function PlayerInfoModal({
  player,
  gameState,
  onMarkUnavailable,
  onMarkAvailable,
  onClose,
}) {
  if (!player) return null;

  const { points, currentStats, unavailablePlayerIds } = gameState;
  const isUnavailable = (unavailablePlayerIds || []).includes(player.id);
  const genderDotClass = GENDER_DOT_STYLES[player.gender] || 'bg-navy-400';

  const detailed = getDetailedPlayerStats(player.id, points, Date.now());
  const accumulated = getAggregatedPlayerStats(player.id, points);
  const full = getPlayerStats(player.id, points);

  let currentGoals = 0;
  let currentAssists = 0;
  let currentDs = 0;
  for (const s of (currentStats || [])) {
    if (s.playerId === player.id) {
      if (s.type === 'goal') currentGoals++;
      else if (s.type === 'assist') currentAssists++;
      else if (s.type === 'D') currentDs++;
    }
  }

  const totalGoals = accumulated.goals + currentGoals;
  const totalAssists = accumulated.assists + currentAssists;
  const totalDs = accumulated.ds + currentDs;
  const totalMinutes = Math.round(detailed.totalPlayingTimeMs / 60000);
  const benchMinutes = Math.round(detailed.benchTimeMs / 60000);

  const statRows = [
    { label: 'Points played', value: detailed.pointsPlayed },
    { label: 'Playing time', value: `${totalMinutes}m` },
    { label: 'Bench time', value: `${benchMinutes}m` },
    { label: 'Goals', value: totalGoals },
    { label: 'Assists', value: totalAssists },
    { label: 'Ds', value: totalDs },
    { label: '+/-', value: `${full.plusMinus >= 0 ? '+' : ''}${full.plusMinus}` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-navy-800 border-t border-navy-600 w-full max-w-lg rounded-t-2xl p-4"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${genderDotClass}`} />
            <span className="font-semibold text-white text-lg leading-tight">{player.name}</span>
            <span className="text-xs text-navy-300">G{player.grade}</span>
            {isUnavailable && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-score-red/20 text-score-red">
                Unavailable
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-navy-300 active:text-white text-2xl leading-none font-light"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs uppercase text-navy-400 font-semibold mb-2">Game Stats</div>
          <div className="space-y-1">
            {statRows.map(row => (
              <div key={row.label} className="flex items-center justify-between bg-navy-900 rounded-lg px-3 py-2">
                <span className="text-sm text-navy-300">{row.label}</span>
                <span className="text-sm font-semibold text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {isUnavailable ? (
          <button
            onClick={() => { onMarkAvailable(player.id); onClose(); }}
            className="w-full py-3 rounded-lg font-semibold text-sm bg-score-green/20 text-score-green border border-score-green/40 active:bg-score-green/30 transition-colors"
            style={{ minHeight: 48 }}
          >
            Mark Available
          </button>
        ) : (
          <button
            onClick={() => { onMarkUnavailable(player.id); onClose(); }}
            className="w-full py-3 rounded-lg font-semibold text-sm bg-score-red/20 text-score-red border border-score-red/40 active:bg-score-red/30 transition-colors"
            style={{ minHeight: 48 }}
          >
            Mark Unavailable (Injured / Sitting Out)
          </button>
        )}

        <button onClick={onClose} className="btn-primary w-full mt-2" style={{ minHeight: 48 }}>
          Close
        </button>
      </div>
    </div>
  );
}
