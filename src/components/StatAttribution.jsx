import { useState } from 'react';
import { STAT_TYPES } from '../utils/pointStats';

const STAT_CHIP_STYLES = {
  goal: 'bg-green-500/20 border border-green-500/40 text-green-400',
  assist: 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400',
  D: 'bg-blue-500/20 border border-blue-500/40 text-blue-400',
};

const STAT_BUTTON_STYLES = {
  goal: 'bg-green-600 text-white active:bg-green-700',
  assist: 'bg-yellow-500 text-navy-950 active:bg-yellow-600',
  D: 'bg-blue-600 text-white active:bg-blue-700',
};

export default function StatAttribution({
  pointIndex,
  stats,
  lineupPlayerIds,
  players,
  onAddStat,
  onRemoveStat,
  editable,
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  const lineupPlayers = lineupPlayerIds
    .map(id => players.find(p => p.id === id))
    .filter(Boolean);

  function handleStatType(statType) {
    if (!selectedPlayerId) return;
    onAddStat(pointIndex, selectedPlayerId, statType);
    setSelectedPlayerId(null);
    setExpanded(false);
  }

  function handleRemove(playerId, statType) {
    onRemoveStat(pointIndex, playerId, statType);
  }

  const statsWithNames = (stats || []).map(s => ({
    ...s,
    player: players.find(p => p.id === s.playerId),
  }));

  return (
    <div className="mt-4">
      <div className="text-xs uppercase text-navy-300 font-semibold mb-2">Point Stats</div>

      {/* Existing stat chips */}
      {statsWithNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {statsWithNames.map((s, i) => {
            const style = STAT_CHIP_STYLES[s.type] || 'bg-navy-700 text-navy-200';
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${style}`}
                style={{ minHeight: 32 }}
              >
                <span>{s.player?.name || 'Unknown'}</span>
                <span className="opacity-70">{STAT_TYPES.find(t => t.key === s.type)?.label || s.type}</span>
                {editable && (
                  <button
                    onClick={() => handleRemove(s.playerId, s.type)}
                    className="ml-0.5 opacity-70 active:opacity-100 font-bold leading-none"
                    style={{ minWidth: 20, minHeight: 20 }}
                    aria-label="Remove stat"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Add stat button + expandable section */}
      {editable && (
        <>
          {!expanded ? (
            <button
              onClick={() => { setExpanded(true); setSelectedPlayerId(null); }}
              className="text-xs font-semibold text-navy-300 border border-dashed border-navy-600 px-3 py-2 rounded-lg active:bg-navy-800 transition-colors"
              style={{ minHeight: 36 }}
            >
              + Add Stat
            </button>
          ) : (
            <div className="card p-3 space-y-3">
              {/* Player selection */}
              <div>
                <div className="text-xs text-navy-400 mb-2">Select player</div>
                <div className="flex flex-wrap gap-1.5">
                  {lineupPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(
                        selectedPlayerId === player.id ? null : player.id
                      )}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors active:scale-95 ${
                        selectedPlayerId === player.id
                          ? 'bg-gold text-navy-950'
                          : 'bg-navy-700 text-navy-200 active:bg-navy-600'
                      }`}
                      style={{ minHeight: 36 }}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stat type selection (shown once player is selected) */}
              {selectedPlayerId && (
                <div>
                  <div className="text-xs text-navy-400 mb-2">Select stat</div>
                  <div className="flex gap-2">
                    {STAT_TYPES.map(stat => (
                      <button
                        key={stat.key}
                        onClick={() => handleStatType(stat.key)}
                        className={`flex-1 text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors active:scale-95 ${STAT_BUTTON_STYLES[stat.key] || 'bg-navy-600 text-white'}`}
                        style={{ minHeight: 44 }}
                      >
                        {stat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancel */}
              <button
                onClick={() => { setExpanded(false); setSelectedPlayerId(null); }}
                className="text-xs text-navy-400 w-full text-center py-1.5 active:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
