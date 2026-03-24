import { useState } from 'react';

const RATIO_OPTIONS = [
  { bx: 3, gx: 2 },
  { bx: 2, gx: 3 },
  { bx: 4, gx: 1 },
  { bx: 1, gx: 4 },
  { bx: 5, gx: 0 },
  { bx: 0, gx: 5 },
];

export default function PatternBuilderModal({ initialPattern, onSave, onClose }) {
  const [pattern, setPattern] = useState(
    initialPattern && initialPattern.length > 0
      ? initialPattern
      : [{ bx: 3, gx: 2 }, { bx: 2, gx: 3 }]
  );

  function addPoint() {
    setPattern(prev => [...prev, { bx: 3, gx: 2 }]);
  }

  function removePoint(index) {
    if (pattern.length <= 1) return;
    setPattern(prev => prev.filter((_, i) => i !== index));
  }

  function setRatio(index, ratio) {
    setPattern(prev => prev.map((r, i) => i === index ? ratio : r));
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="bg-navy-900 rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-navy-700">
          <h3 className="font-display text-lg tracking-wide">Build Ratio Pattern</h3>
          <button
            onClick={onClose}
            className="text-navy-400 text-2xl leading-none"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        {/* Pattern preview */}
        <div className="px-4 py-3 bg-navy-800/50 border-b border-navy-700">
          <div className="text-[10px] uppercase text-navy-400 font-semibold mb-1">Pattern (repeats)</div>
          <div className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {pattern.map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gold">{r.bx}bx/{r.gx}gx</span>
                {i < pattern.length - 1 && <span className="text-navy-500">→</span>}
              </span>
            ))}
            <span className="text-navy-500 text-xs ml-1">→ repeats</span>
          </div>
        </div>

        {/* Scrollable point list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {pattern.map((r, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-navy-400 font-semibold">Point {i + 1}</span>
                {pattern.length > 1 && (
                  <button
                    onClick={() => removePoint(i)}
                    className="text-xs text-navy-500 active:text-score-red px-2 py-1 rounded"
                    style={{ minHeight: 32 }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {RATIO_OPTIONS.map(opt => (
                  <button
                    key={`${opt.bx}/${opt.gx}`}
                    onClick={() => setRatio(i, opt)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      r.bx === opt.bx && r.gx === opt.gx
                        ? 'bg-gold text-navy-950'
                        : 'bg-navy-800 text-navy-200 border border-navy-700 active:bg-navy-700'
                    }`}
                    style={{ minHeight: 36 }}
                  >
                    {opt.bx}bx/{opt.gx}gx
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={addPoint}
            className="w-full py-3 rounded-xl border border-dashed border-navy-600 text-navy-400 text-sm active:bg-navy-800 transition-colors"
            style={{ minHeight: 44 }}
          >
            + Add point to pattern
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-navy-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-navy-600 text-navy-300 text-sm font-semibold active:bg-navy-800"
            style={{ minHeight: 48 }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(pattern); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-gold text-navy-950 text-sm font-bold active:bg-gold/80"
            style={{ minHeight: 48 }}
          >
            Save Pattern
          </button>
        </div>
      </div>
    </div>
  );
}
