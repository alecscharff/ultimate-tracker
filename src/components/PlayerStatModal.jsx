import { STAT_TYPES } from '../utils/pointStats';

const STAT_CHIP_STYLES = {
  goal: 'bg-green-500/20 border border-green-500/40 text-green-400',
  assist: 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400',
  D: 'bg-blue-500/20 border border-blue-500/40 text-blue-400',
};

const STAT_BUTTON_STYLES = {
  D: 'bg-blue-600 text-white active:bg-blue-700',
  assist: 'bg-yellow-500 text-navy-950 active:bg-yellow-600',
  goal: 'bg-green-600 text-white active:bg-green-700',
};

const GENDER_DOT_STYLES = {
  gx: 'bg-purple-500',
  bx: 'bg-blue-500',
};

export default function PlayerStatModal({
  player,
  pointIndex,
  stats,
  onAddStat,
  onRemoveStat,
  onClose,
}) {
  if (!player) return null;

  const genderDotClass = GENDER_DOT_STYLES[player.gender] || 'bg-navy-400';

  function handleAdd(statType) {
    onAddStat(pointIndex, player.id, statType);
  }

  function handleRemove(statType) {
    onRemoveStat(pointIndex, player.id, statType);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-navy-800 border-t border-navy-600 w-full max-w-lg rounded-t-2xl p-4 animate-slide-up"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${genderDotClass}`}
            />
            <span className="font-semibold text-white text-lg leading-tight">
              {player.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-navy-300 active:text-white text-2xl leading-none font-light"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Stat buttons */}
        <div className="flex gap-2 mb-4">
          {STAT_TYPES.map(stat => (
            <button
              key={stat.key}
              onClick={() => handleAdd(stat.key)}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm active:scale-95 transition-transform ${STAT_BUTTON_STYLES[stat.key] || 'bg-navy-600 text-white'}`}
              style={{ minHeight: 48 }}
            >
              {stat.label}
            </button>
          ))}
        </div>

        {/* Existing stats for this player on this point */}
        {stats.length > 0 && (
          <div className="mb-4">
            <div className="text-xs uppercase text-navy-400 font-semibold mb-2">
              Stats this point
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.map((s, i) => {
                const statDef = STAT_TYPES.find(t => t.key === s.type);
                const chipStyle = STAT_CHIP_STYLES[s.type] || 'bg-navy-700 border border-navy-600 text-navy-200';
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium ${chipStyle}`}
                    style={{ minHeight: 32 }}
                  >
                    <span>{statDef?.label || s.type}</span>
                    <button
                      onClick={() => handleRemove(s.type)}
                      className="text-score-red/80 active:text-score-red font-bold leading-none cursor-pointer"
                      style={{ minWidth: 20, minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label={`Remove ${statDef?.label || s.type}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Done button */}
        <button
          onClick={onClose}
          className="btn-primary w-full"
          style={{ minHeight: 48 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
