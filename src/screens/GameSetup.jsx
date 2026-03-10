import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { getSetting, setSetting } from '../services/settingsService';
import { useGame } from '../context/GameContext';
import { extractSheetId, fetchSheetCSV, parseScheduleFromCSV } from '../utils/sheets';

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
  const location = useLocation();
  const { state: gameState, dispatch } = useGame();
  const players = usePlayers();

  // Check if we have a pre-filled game from Home screen
  const prefilledGame = location.state?.prefilledGame;

  const [opponent, setOpponent] = useState(prefilledGame?.opponent || '');
  const [date, setDate] = useState(prefilledGame?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(
    prefilledGame?.startTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [field, setField] = useState(prefilledGame?.field || '');
  const [selectedRatio, setSelectedRatio] = useState(2); // Alt 3/2 & 2/3
  const [checkedIn, setCheckedIn] = useState(new Set());

  // Schedule import state
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleUrl, setScheduleUrl] = useState('');
  const [scheduleTab, setScheduleTab] = useState('Schedule');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleGames, setScheduleGames] = useState(null);

  // Load saved schedule URL (reuse roster sheet URL if available)
  useEffect(() => {
    getSetting('scheduleSheetUrl').then(v => { if (v) setScheduleUrl(v); }).catch(() => {});
    getSetting('scheduleSheetTab').then(v => {
      if (v) setScheduleTab(v);
      else getSetting('rosterSheetUrl').then(v2 => { if (v2) setScheduleUrl(v2); }).catch(() => {});
    }).catch(() => {});
  }, []);

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

  async function handleFetchSchedule() {
    setScheduleError('');
    setScheduleGames(null);

    const sheetId = extractSheetId(scheduleUrl);
    if (!sheetId) {
      setScheduleError('Invalid Google Sheets URL.');
      return;
    }

    setScheduleLoading(true);
    try {
      await setSetting('scheduleSheetUrl', scheduleUrl);
      await setSetting('scheduleSheetTab', scheduleTab);

      const csv = await fetchSheetCSV(sheetId, scheduleTab);
      const games = parseScheduleFromCSV(csv);

      if (games.length === 0) {
        setScheduleError('No games found. Expected columns: Date, Opponent, Start Time, Field');
      } else {
        setScheduleGames(games);
      }
    } catch (err) {
      setScheduleError(err.message || 'Failed to fetch schedule. Make sure the sheet is published.');
    } finally {
      setScheduleLoading(false);
    }
  }

  function selectScheduleGame(game) {
    if (game.opponent) setOpponent(game.opponent);
    if (game.date) setDate(game.date);
    if (game.startTime) setStartTime(game.startTime);
    if (game.field) setField(game.field);
    setShowSchedule(false);
    setScheduleGames(null);
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
        <button onClick={() => navigate('/')} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
        <h1 className="font-display text-2xl">NEW GAME</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Load from Sheet */}
        <div>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-sm text-gold font-semibold underline underline-offset-2 active:text-gold-light py-1"
            style={{ minHeight: '44px' }}
          >
            {showSchedule ? 'Hide schedule import' : 'Load from Google Sheets'}
          </button>

          {showSchedule && (
            <div className="card p-4 mt-2 space-y-3">
              <p className="text-xs text-navy-300 leading-relaxed">
                Import game info from your schedule sheet. Expected columns: Date, Opponent, Start Time, Field.
                Sheet must be published to the web.
              </p>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={scheduleUrl}
                onChange={e => setScheduleUrl(e.target.value)}
                className="w-full text-sm"
              />
              <input
                type="text"
                placeholder="Sheet tab name (e.g. 'Schedule')"
                value={scheduleTab}
                onChange={e => setScheduleTab(e.target.value)}
                className="w-full text-sm"
              />
              <button
                onClick={handleFetchSchedule}
                disabled={!scheduleUrl.trim() || scheduleLoading}
                className="btn-gold w-full"
              >
                {scheduleLoading ? 'Fetching...' : 'Fetch Schedule'}
              </button>

              {scheduleError && (
                <p className="text-xs text-score-red">{scheduleError}</p>
              )}

              {scheduleGames && (
                <div className="space-y-2">
                  <div className="text-xs text-navy-300 font-semibold">
                    Select a game to auto-fill:
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {scheduleGames.map((game, i) => (
                      <button
                        key={i}
                        onClick={() => selectScheduleGame(game)}
                        className="w-full card px-4 py-3 text-left active:bg-navy-700 transition-colors"
                        style={{ minHeight: '44px' }}
                      >
                        <div className="text-sm font-semibold">vs {game.opponent}</div>
                        <div className="text-xs text-navy-300">
                          {game.date}{game.startTime ? ` at ${game.startTime}` : ''}{game.field ? ` -- ${game.field}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
          <label className="text-xs uppercase text-navy-300 font-semibold mb-2 block">
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
                    : 'bg-navy-800 text-navy-200 border border-navy-700 active:bg-navy-700'
                }`}
                style={{ minHeight: '44px' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player check-in */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase text-navy-300 font-semibold">
              Players Present ({checkedIn.size})
            </label>
            <div className="flex gap-3 text-xs">
              <button onClick={selectAll} className="text-navy-300 underline active:text-white py-1 px-2" style={{ minHeight: '36px' }}>All</button>
              <button onClick={selectNone} className="text-navy-300 underline active:text-white py-1 px-2" style={{ minHeight: '36px' }}>None</button>
            </div>
          </div>
          <div className="text-xs text-navy-400 mb-2">
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
                style={{ minHeight: '44px' }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
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
                  <span className="font-semibold truncate flex-1 min-w-0">{player.name}</span>
                  <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded text-center w-8 flex-shrink-0 ${
                    player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                  }`}>{player.gender}</span>
                  <span className="text-[11px] text-navy-300 font-mono w-8 text-center flex-shrink-0">G{player.grade}</span>
                </div>
              </button>
            ))}
          </div>
          {players.length === 0 && (
            <div className="text-center text-navy-400 py-8">
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
