export default function GameActionBar({
  phase,
  isViewingCurrentPoint,
  onAutoPickLineup,
  onStartPoint,
  onWeScored,
  onTheyScored,
  onTimeout,
  onResumePoint,
  onEndGame,
  onHalftime,
  onBackToCurrent,
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-navy-700 p-3 pb-safe z-30">
      {/* Viewing a past/future point — just return to current */}
      {!isViewingCurrentPoint && (
        <button
          onClick={onBackToCurrent}
          className="btn bg-gold text-navy-950 w-full font-bold"
          style={{ minHeight: 52 }}
        >
          ← Back to Current Point
        </button>
      )}

      {/* Pre-point: auto-pick + start + end game */}
      {isViewingCurrentPoint && phase === 'pre-point' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <button
              onClick={onAutoPickLineup}
              className="btn-primary flex-none px-5 text-sm"
              style={{ minHeight: 52 }}
            >
              Auto-pick
            </button>
            <button
              onClick={onStartPoint}
              className="btn-gold flex-1 text-base font-bold"
              style={{ minHeight: 52 }}
            >
              Start Point
            </button>
          </div>
          <div className="flex gap-2">
            {onHalftime && (
              <button
                onClick={onHalftime}
                className="btn flex-1 text-sm text-navy-300 bg-transparent border border-navy-600"
                style={{ minHeight: 40 }}
              >
                Halftime
              </button>
            )}
            <button
              onClick={onEndGame}
              className={`btn text-sm text-navy-300 bg-transparent border border-navy-600 ${onHalftime ? 'flex-1' : 'w-full'}`}
              style={{ minHeight: 40 }}
            >
              End Game
            </button>
          </div>
        </div>
      )}

      {/* Timeout-sub: auto-pick + resume point */}
      {isViewingCurrentPoint && phase === 'timeout-sub' && (
        <div className="flex gap-3">
          <button
            onClick={onAutoPickLineup}
            className="btn-primary flex-none px-5 text-sm"
            style={{ minHeight: 52 }}
          >
            Auto-pick
          </button>
          <button
            onClick={onResumePoint}
            className="btn-gold flex-1 text-base font-bold"
            style={{ minHeight: 52 }}
          >
            Resume Point
          </button>
        </div>
      )}

      {/* Playing: timeout + we scored + they scored */}
      {isViewingCurrentPoint && phase === 'playing' && (
        <div className="flex gap-2">
          <button
            onClick={onTimeout}
            className="btn-primary flex-none text-sm px-4"
            style={{ minHeight: 52 }}
          >
            Timeout
          </button>
          <button
            onClick={onWeScored}
            className="btn flex-1 bg-score-green text-white font-bold text-base"
            style={{ minHeight: 52 }}
          >
            We Scored
          </button>
          <button
            onClick={onTheyScored}
            className="btn flex-1 bg-score-red text-white font-bold text-base"
            style={{ minHeight: 52 }}
          >
            They Scored
          </button>
        </div>
      )}

      {/* Halftime */}
      {isViewingCurrentPoint && phase === 'halftime' && (
        <div className="flex items-center justify-center py-2">
          <span className="text-gold font-display text-xl tracking-widest">HALFTIME</span>
        </div>
      )}

      {/* Finished */}
      {isViewingCurrentPoint && phase === 'finished' && (
        <button
          onClick={onEndGame}
          className="btn-gold w-full font-bold text-base"
          style={{ minHeight: 52 }}
        >
          Save & Exit
        </button>
      )}
    </div>
  );
}
