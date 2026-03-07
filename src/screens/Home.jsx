import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function Home() {
  const navigate = useNavigate();
  const { state } = useGame();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {/* Branding */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-3">M</div>
        <h1 className="font-display text-5xl tracking-wide text-white leading-none">
          WEDGWOOD
        </h1>
        <h2 className="font-display text-3xl tracking-[0.3em] text-gold mt-1">
          MARMOTS
        </h2>
        <div className="mt-3 h-0.5 w-20 mx-auto bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className="text-navy-400 text-sm mt-3 uppercase tracking-widest">Ultimate Tracker</p>
      </div>

      {/* Active game banner */}
      {state.active && (
        <button
          onClick={() => navigate('/game/play')}
          className="w-full max-w-xs mb-4 card border-gold bg-gold/10 p-4 text-center active:bg-gold/20 transition-colors"
        >
          <div className="text-xs uppercase text-gold font-semibold mb-1">Game In Progress</div>
          <div className="font-display text-3xl text-white">
            {state.ourScore} - {state.theirScore}
          </div>
          <div className="text-sm text-navy-300">vs {state.opponent}</div>
          <div className="text-xs text-gold mt-2 font-semibold">TAP TO RESUME</div>
        </button>
      )}

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {!state.active && (
          <button
            onClick={() => navigate('/game/setup')}
            className="btn-gold w-full text-lg"
          >
            New Game
          </button>
        )}
        <button
          onClick={() => navigate('/roster')}
          className="btn-primary w-full"
        >
          Manage Roster
        </button>
        <button
          onClick={() => navigate('/games')}
          className="btn-primary w-full"
        >
          Past Games
        </button>
      </div>
    </div>
  );
}
