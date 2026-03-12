import { useState, useEffect } from 'react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Scoreboard({ ourScore, theirScore, opponent, gameStartedAt, pointStartedAt, phase, currentPointNumber }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const gameElapsed = gameStartedAt ? Math.floor((Date.now() - gameStartedAt) / 1000) : 0;
  const pointElapsed = pointStartedAt ? Math.floor((Date.now() - pointStartedAt) / 1000) : 0;
  const gameMinutes = gameElapsed / 60;

  return (
    <div className="bg-navy-900 border-b border-navy-700 sticky top-0 z-20">
      {/* Score */}
      <div className="flex items-center justify-center gap-3 pt-3 pb-1 px-4">
        <div className="text-right flex-1">
          <div className="text-xs uppercase tracking-wider text-navy-300 font-semibold">Marmots</div>
          <div className="font-display text-5xl leading-none text-white">{ourScore}</div>
        </div>
        <div className="text-navy-500 font-display text-3xl px-2">-</div>
        <div className="text-left flex-1">
          <div className="text-xs uppercase tracking-wider text-navy-300 font-semibold">{opponent || 'Opponent'}</div>
          <div className="font-display text-5xl leading-none text-white">{theirScore}</div>
        </div>
      </div>

      {/* Clock row */}
      <div className="flex items-center justify-center gap-4 pb-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-navy-300">Game</span>
          <span className={`font-mono font-semibold ${gameMinutes >= 55 ? 'text-score-red' : gameMinutes >= 25 ? 'text-gold' : 'text-white'}`}>
            {formatTime(gameElapsed)}
          </span>
        </div>
        {phase === 'timeout-sub' && (
          <div className="flex items-center gap-1.5">
            <span className="text-gold font-semibold text-xs uppercase tracking-wide animate-pulse">Timeout</span>
          </div>
        )}
        {phase === 'playing' && (
          <div className="flex items-center gap-1.5">
            <span className="text-navy-300">Point</span>
            <span className={`font-mono font-semibold ${pointElapsed >= 540 ? 'text-gold animate-pulse' : 'text-white'}`}>
              {formatTime(pointElapsed)}
            </span>
          </div>
        )}
        <div className="text-navy-500">
          Pt {currentPointNumber}
        </div>
      </div>
    </div>
  );
}
