export default function SpectatorStatBar({ selectedPlayer, onRecordStat, onDeselect }) {
  if (!selectedPlayer) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-navy-700 p-3 pb-safe z-30">
      {/* Player name row */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-white truncate pr-2">{selectedPlayer.name}</span>
        <button
          onClick={onDeselect}
          className="text-navy-400 active:text-white transition-colors flex-shrink-0"
          style={{ minWidth: 32, minHeight: 32 }}
          aria-label="Deselect player"
        >
          ×
        </button>
      </div>

      {/* Stat buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onRecordStat('D')}
          className="flex-1 rounded-lg font-semibold text-sm py-2.5 min-h-[44px] bg-blue-600 text-white active:scale-95 transition-transform"
        >
          D
        </button>
        <button
          onClick={() => onRecordStat('assist')}
          className="flex-1 rounded-lg font-semibold text-sm py-2.5 min-h-[44px] bg-yellow-500 text-navy-950 active:scale-95 transition-transform"
        >
          Assist
        </button>
        <button
          onClick={() => onRecordStat('goal')}
          className="flex-1 rounded-lg font-semibold text-sm py-2.5 min-h-[44px] bg-green-600 text-white active:scale-95 transition-transform"
        >
          Goal
        </button>
      </div>
    </div>
  );
}
