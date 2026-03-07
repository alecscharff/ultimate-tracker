import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { useGame } from '../context/GameContext';

const RATIO_PRESETS = [
  { label: '3bx / 2gx', patterns: [{ bx: 3, gx: 2 }] },
  { label: '2bx / 3gx', patterns: [{ bx: 2, gx: 3 }] },
  { label: 'Alt 3/2 & 2/3', patterns: [{ bx: 3, gx: 2 }, { bx: 2, gx: 3 }] },
  { label: '4bx / 1gx', patterns: [{ bx: 4, gx: 1 }] },
  { label: '1bx / 4gx', patterns: [{ bx: 1, gx: 4 }] },
  { label: '5bx / 0gx', patterns: [{ bx: 5, gx: 0 }] },
  { label: '0bx / 5gx', patterns: [{ bx: 0, gx: 5 }] },
];

export default function GameSetup() {
  const navigate = useNavigate();
  const { state: gameState, dispatch } = useGame();
  const players = useLiveQuery(() => db.players.orderBy('name').toArray()) || [];

  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [field, setField] = useState('');
  const [selectedRatio, setSelectedRatio] = useState(2); // Alt 3/2 & 2/3
  const [checkedIn, setCheckedIn] = useState(new Set());

  function togglePlayer(id) {
    setCheckedIn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setCheckedIn(new Set(players.map(p => p.id)));
  }

  function selectNone() {
    setCheckedIn(new Set());
  }

  function startGame() {
    if (!opponent.trim() || checkedIn.size < 5) return;

    dispatch({
      type: 'START_GAME',
      opponent: opponent.trim(),
      date,
      startTime,
      field: field.trim(),
      playerIds: [...checkedIn],
      ratioPattern: RATIO_PRESETS[selectedRatio].patterns,
    });

    navigate('/game/play');
  }

  if (gameState.active) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl mb-4">Game Already Active</h2>
          <p className="text-navy-300 mb-6">vs {gameState.opponent}</p>
          <button onClick={() => navigate('/game/play')} className="btn-gold">
            Resume Game
          </button>
        </div>
      </div>
    );
  }

  const bxCount = [...checkedIn].filter(id => players.find(p => p.id === id)?.gender === 'bx').length;
  const gxCount = [...checkedIn].filter(id => players.find(p => p.id === id)?.gender === 'gx').length;

  return (
    <div className="min-h-dvh pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-navy-400 active:text-white text-2xl leading-none">&larr;</button>
        <h1 className="font-display text-2xl">NEW GAME</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Game info */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Opponent name"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            className="w-full text-lg"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="flex-1"
            />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-28"
            />
          </div>
          <input
            type="text"
            placeholder="Field / location"
            value={field}
            onChange={e => setField(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Gender ratio */}
        <div>
          <label className="text-xs uppercase text-navy-400 font-semibold mb-2 block">
            Default Gender Ratio
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RATIO_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => setSelectedRatio(i)}
                className={`py-3 px-3 rounded-xl text-sm font-semibold transition-all ${
                  selectedRatio === i
                    ? 'bg-gold text-navy-950'
                    : 'bg-navy-800 text-navy-300 border border-navy-700 active:bg-navy-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player check-in */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase text-navy-400 font-semibold">
              Players Present ({checkedIn.size})
            </label>
            <div className="flex gap-3 text-xs">
              <button onClick={selectAll} className="text-navy-400 underline active:text-white">All</button>
              <button onClick={selectNone} className="text-navy-400 underline active:text-white">None</button>
            </div>
          </div>
          <div className="text-xs text-navy-500 mb-2">
            {bxCount} bx, {gxCount} gx checked in
          </div>
          <div className="space-y-1.5">
            {players.map(player => (
              <button
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                className={`w-full card px-4 py-3 flex items-center justify-between text-left transition-all ${
                  checkedIn.has(player.id)
                    ? 'border-gold/50 bg-navy-800'
                    : 'border-navy-700/50 bg-navy-800/40 opacity-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    checkedIn.has(player.id)
                      ? 'border-gold bg-gold'
                      : 'border-navy-600'
                  }`}>
                    {checkedIn.has(player.id) && (
                      <svg className="w-3 h-3 text-navy-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-semibold">{player.name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                  }`}>
                    {player.gender}
                  </span>
                  <span className="text-[10px] text-navy-400 font-mono">G{player.grade}</span>
                </div>
              </button>
            ))}
          </div>
          {players.length === 0 && (
            <div className="text-center text-navy-500 py-8">
              <p>No players on roster.</p>
              <button onClick={() => navigate('/roster')} className="text-gold underline mt-2">
                Add players first
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Start button */}
      <div className="px-4 pt-2">
        <button
          onClick={startGame}
          disabled={!opponent.trim() || checkedIn.size < 5}
          className="btn-gold w-full text-lg py-5"
        >
          Start Game ({checkedIn.size} players)
        </button>
        {checkedIn.size > 0 && checkedIn.size < 5 && (
          <p className="text-score-red text-xs text-center mt-2">Need at least 5 players checked in</p>
        )}
      </div>
    </div>
  );
}
