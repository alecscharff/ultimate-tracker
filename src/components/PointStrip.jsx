import { useRef, useEffect } from 'react';

export default function PointStrip({
  points,
  currentPointNumber,
  ourScore,
  theirScore,
  selectedIndex,
  futureLineups,
  onSelectPoint,
  phase,
}) {
  const currentRef = useRef(null);

  // Auto-scroll to the current/active point on mount and after score changes
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [ourScore, theirScore]);

  const isCurrentSelected = selectedIndex === null;

  return (
    <div className="overflow-x-auto flex gap-2 px-4 py-3 point-strip bg-navy-900 border-b border-navy-700">
      {/* Past points */}
      {points.map((pt, i) => {
        const isSelected = selectedIndex === i;
        const scoredUs = pt.scoredBy === 'us';
        const baseStyle = scoredUs
          ? 'bg-green-500/20 border border-green-500/40 text-green-400'
          : 'bg-red-500/20 border border-red-500/40 text-red-400';
        return (
          <button
            key={i}
            onClick={() => onSelectPoint(i)}
            className={`flex-shrink-0 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 ${baseStyle} ${isSelected ? 'ring-2 ring-white' : ''}`}
            style={{ width: 44, height: 48, minWidth: 44 }}
          >
            <span className="text-xs font-bold leading-none">{pt.number || i + 1}</span>
            <span className="text-[10px] leading-none mt-0.5">{scoredUs ? 'US' : 'Them'}</span>
          </button>
        );
      })}

      {/* Current point */}
      {phase !== 'finished' && (
        <button
          ref={currentRef}
          onClick={() => onSelectPoint(null)}
          className={`flex-shrink-0 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400 ${isCurrentSelected ? 'ring-2 ring-white' : ''}`}
          style={{ width: 44, height: 48, minWidth: 44 }}
        >
          <span className="text-xs font-bold leading-none">{currentPointNumber}</span>
          {phase === 'playing' && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse mt-1" />
          )}
        </button>
      )}

      {/* Future preview points */}
      {futureLineups.map((preview) => {
        const isSelected = selectedIndex === preview.pointNumber - 1;
        // pointNumber is 1-based; in the points array it's at index points.length + futureOffset
        const futureIndex = preview.pointNumber - 1;
        return (
          <button
            key={preview.pointNumber}
            onClick={() => onSelectPoint(futureIndex)}
            className={`flex-shrink-0 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 bg-navy-800/40 border border-dashed border-navy-600 text-navy-400 ${isSelected ? 'ring-2 ring-white' : ''}`}
            style={{ width: 44, height: 48, minWidth: 44 }}
          >
            <span className="text-[10px] font-bold leading-none">{preview.pointNumber}</span>
            <span className="text-[9px] leading-none mt-0.5">{preview.ratio.bx}/{preview.ratio.gx}</span>
          </button>
        );
      })}
    </div>
  );
}
