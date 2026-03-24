export default function GameEndRulesModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex flex-col"
      onClick={onClose}
    >
      <div
        className="bg-navy-900 flex-1 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-display text-xl tracking-wide">GAME END RULES</h2>
          <button
            onClick={onClose}
            className="text-navy-400 active:text-white text-2xl leading-none"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 pb-12">
          {/* Flowchart */}
          <div className="flex flex-col items-center gap-0 max-w-sm mx-auto">

            {/* Node helper styles are inlined via className */}
            <FlowNode color="gray" title="Game in progress" subtitle="First to 11 points wins" />
            <Arrow />
            <FlowNode color="gold" title="60-minute cap hits" />
            <Arrow />
            <FlowNode color="teal" title="Finish the current point" subtitle="If between points, play the next one too" />
            <Arrow />

            {/* Tied? decision */}
            <div className="w-full flex items-start gap-2">
              <div className="flex-1 flex flex-col items-center">
                <FlowNode color="gray" title="Is the score tied?" wide />
                <BranchLabel label="Yes — tied!" />
                <Arrow />
                <FlowNode color="indigo" title="Universe point!" subtitle="Sudden death — first to score wins" wide />
                <Arrow />
                {/* 70 min? */}
                <div className="w-full flex items-start gap-2">
                  <div className="flex-1 flex flex-col items-center">
                    <FlowNode color="gold" title="Does 70 min hit during universe point?" wide />
                    <BranchLabel label="Yes" />
                    <Arrow />
                    <FlowNode color="indigo" title="Each team: 1 more possession" subtitle="One last chance each to score" wide />
                    <Arrow />
                    {/* Still tied? */}
                    <div className="w-full flex items-start gap-2">
                      <div className="flex-1 flex flex-col items-center">
                        <FlowNode color="gray" title="Still tied?" subtitle="After both possessions played" wide />
                        <BranchLabel label="No" />
                        <Arrow />
                        <FlowNode color="green" title="Scoring team wins!" wide />
                      </div>
                      <div className="flex flex-col items-center pt-14 w-28 flex-shrink-0">
                        <BranchSideLabel label="Yes →" />
                        <FlowNode color="red" title="Game ends in a TIE" subtitle="DiscNW allows this!" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center pt-14 w-28 flex-shrink-0">
                    <BranchSideLabel label="No →" />
                    <FlowNode color="green" title="First team to score wins!" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center pt-14 w-28 flex-shrink-0">
                <BranchSideLabel label="No →" />
                <FlowNode color="green" title="Leading team wins!" />
              </div>
            </div>
          </div>

          {/* Reference links */}
          <div className="mt-8 pt-4 border-t border-navy-700 space-y-2">
            <p className="text-xs text-navy-400 uppercase font-semibold tracking-wide mb-3">Official Rules</p>
            <a
              href="https://www.discnw.org/youth-league-rules"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 card px-4 py-3 active:bg-navy-700 transition-colors"
              style={{ minHeight: 44 }}
            >
              <span className="text-sm font-semibold text-gold flex-1">DiscNW Youth League Rules</span>
              <span className="text-navy-400 text-xs">↗</span>
            </a>
            <a
              href="https://usaultimate.org/rules/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 card px-4 py-3 active:bg-navy-700 transition-colors"
              style={{ minHeight: 44 }}
            >
              <span className="text-sm font-semibold text-gold flex-1">USA Ultimate Official Rules</span>
              <span className="text-navy-400 text-xs">↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ color, title, subtitle, wide }) {
  const colors = {
    gray:   'bg-gray-700 text-white',
    gold:   'bg-yellow-800 text-white',
    teal:   'bg-teal-800 text-white',
    indigo: 'bg-indigo-700 text-white',
    green:  'bg-green-800 text-white',
    red:    'bg-red-800 text-white',
  };
  return (
    <div className={`rounded-xl px-4 py-3 text-center ${colors[color]} ${wide ? 'w-full' : 'w-44'}`}>
      <div className="text-sm font-bold leading-snug">{title}</div>
      {subtitle && <div className="text-xs mt-1 opacity-75 leading-snug">{subtitle}</div>}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center my-0.5">
      <div className="w-px h-4 bg-gray-500" />
      <div className="text-gray-500 text-xs leading-none">▼</div>
    </div>
  );
}

function BranchLabel({ label }) {
  return <div className="text-[10px] text-gray-500 my-0.5">{label}</div>;
}

function BranchSideLabel({ label }) {
  return <div className="text-[10px] text-gray-500 mb-1 text-center">{label}</div>;
}
