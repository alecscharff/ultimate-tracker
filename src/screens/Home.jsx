import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getSetting } from '../services/settingsService';
import { extractSheetId, fetchSheetCSV, parseScheduleFromCSV } from '../utils/sheets';
import { useScheduledGames } from '../hooks/useScheduledGames';
import { createScheduledGame, deleteScheduledGame } from '../services/gameService';

export default function Home() {
  const navigate = useNavigate();
  const { state } = useGame();
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const { scheduledGames } = useScheduledGames();

  // Schedule game form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [formOpponent, setFormOpponent] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('');
  const [formField, setFormField] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdGame, setCreatedGame] = useState(null); // last created — to show spectator link
  const [copiedLink, setCopiedLink] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Today's scheduled games
  const todayGames = scheduledGames.filter(g => g.date === today);
  // Future scheduled games
  const futureScheduledGames = scheduledGames.filter(g => g.date > today);

  // Load upcoming games from schedule sheet
  useEffect(() => {
    async function loadSchedule() {
      try {
        setLoadingSchedule(true);
        const scheduleUrl = await getSetting('scheduleSheetUrl');
        const scheduleTab = await getSetting('scheduleSheetTab') || 'Schedule';

        if (!scheduleUrl) {
          setUpcomingGames([]);
          return;
        }

        const sheetId = extractSheetId(scheduleUrl);
        if (!sheetId) {
          setUpcomingGames([]);
          return;
        }

        const csv = await fetchSheetCSV(sheetId, scheduleTab);
        const allGames = parseScheduleFromCSV(csv);

        const upcoming = allGames.filter(g => g.date >= today);
        setUpcomingGames(upcoming.slice(0, 3));
      } catch (err) {
        console.error('Failed to load schedule:', err);
        setUpcomingGames([]);
      } finally {
        setLoadingSchedule(false);
      }
    }

    loadSchedule();
  }, []);

  function launchScheduledGame(game) {
    navigate('/game/setup', {
      state: {
        prefilledGame: {
          opponent: game.opponent,
          date: game.date,
          startTime: game.startTime,
          field: game.field,
          spectatorId: game.spectatorId,
          scheduledGameId: game.id,
        },
      },
    });
  }

  function quickStartGame(game) {
    navigate('/game/setup', { state: { prefilledGame: game } });
  }

  async function handleCreateScheduledGame(e) {
    e.preventDefault();
    if (!formOpponent.trim()) return;
    setSaving(true);
    try {
      const created = await createScheduledGame({
        opponent: formOpponent.trim(),
        date: formDate,
        startTime: formTime,
        field: formField.trim(),
      });
      setCreatedGame(created);
      setFormOpponent('');
      setFormTime('');
      setFormField('');
      setShowScheduleForm(false);
    } catch (err) {
      console.error('Failed to create scheduled game:', err);
    } finally {
      setSaving(false);
    }
  }

  function spectatorUrl(spectatorId) {
    return `${window.location.origin}/watch/${spectatorId}`;
  }

  function copyLink(spectatorId) {
    navigator.clipboard.writeText(spectatorUrl(spectatorId)).then(() => {
      setCopiedLink(spectatorId);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {
      prompt('Copy this link:', spectatorUrl(spectatorId));
    });
  }

  function daysLabel(date) {
    const d = Math.ceil((new Date(date) - new Date(today)) / (1000 * 60 * 60 * 24));
    if (d === 0) return 'TODAY';
    if (d === 1) return 'TOMORROW';
    return `IN ${d} DAYS`;
  }

  return (
    <div className="min-h-dvh flex flex-col px-6 py-6">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">M</div>
        <h1 className="font-display text-5xl tracking-wide text-white leading-none">
          WEDGWOOD
        </h1>
        <h2 className="font-display text-3xl tracking-[0.3em] text-gold mt-1">
          MARMOTS
        </h2>
        <div className="mt-3 h-0.5 w-20 mx-auto bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className="text-navy-300 text-sm mt-3 uppercase tracking-widest">Ultimate Tracker</p>
      </div>

      {/* Active game banner */}
      {state.active && (
        <button
          onClick={() => navigate('/game/play')}
          className="w-full mb-6 card border-gold bg-gold/10 p-4 text-center active:bg-gold/20 transition-colors"
          style={{ minHeight: '100px' }}
        >
          <div className="text-xs uppercase text-gold font-semibold mb-1">Game In Progress</div>
          <div className="font-display text-3xl text-white">
            {state.ourScore} - {state.theirScore}
          </div>
          <div className="text-sm text-navy-300">vs {state.opponent}</div>
          <div className="text-xs text-gold mt-2 font-semibold">TAP TO RESUME</div>
        </button>
      )}

      {/* Today's scheduled games — shown even when active (for link sharing) */}
      {todayGames.length > 0 && (
        <div className="w-full mb-4">
          <div className="text-xs uppercase text-gold font-semibold mb-2 px-1">Today's Game</div>
          <div className="space-y-2">
            {todayGames.map(game => (
              <div key={game.id} className="card border-gold/40 bg-gold/5 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-lg">vs {game.opponent}</div>
                    {game.startTime && (
                      <div className="text-sm text-gold font-semibold">{game.startTime}</div>
                    )}
                    {game.field && (
                      <div className="text-xs text-navy-400 mt-0.5">{game.field}</div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteScheduledGame(game.id).catch(() => {})}
                    className="text-navy-500 active:text-score-red text-lg leading-none ml-2"
                    style={{ minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                {/* Spectator link */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-navy-400 truncate flex-1 font-mono">
                    {spectatorUrl(game.spectatorId)}
                  </span>
                  <button
                    onClick={() => copyLink(game.spectatorId)}
                    className="text-xs font-semibold text-gold border border-gold/40 rounded-lg px-2 py-1 active:bg-gold/20 flex-shrink-0 transition-colors"
                    style={{ minHeight: 32 }}
                  >
                    {copiedLink === game.spectatorId ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                {!state.active && (
                  <button
                    onClick={() => launchScheduledGame(game)}
                    className="btn-gold w-full mt-3 py-3 text-sm"
                  >
                    Launch Game
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming scheduled games from Firestore */}
      {!state.active && futureScheduledGames.length > 0 && (
        <div className="w-full mb-4">
          <div className="text-xs uppercase text-navy-400 font-semibold mb-2 px-1">Scheduled</div>
          <div className="space-y-2">
            {futureScheduledGames.map(game => (
              <div key={game.id} className="card p-3 border border-navy-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gold uppercase">{daysLabel(game.date)}</span>
                      <span className="font-semibold truncate">vs {game.opponent}</span>
                    </div>
                    <div className="text-xs text-navy-400 mt-0.5">
                      {game.date}{game.startTime ? ` · ${game.startTime}` : ''}{game.field ? ` · ${game.field}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => copyLink(game.spectatorId)}
                      className="text-xs text-navy-300 active:text-gold px-2 py-1 rounded-lg border border-navy-700 active:border-gold/40 transition-colors"
                      style={{ minHeight: 32 }}
                    >
                      {copiedLink === game.spectatorId ? 'Copied!' : 'Link'}
                    </button>
                    <button
                      onClick={() => deleteScheduledGame(game.id).catch(() => {})}
                      className="text-navy-500 active:text-score-red text-lg leading-none"
                      style={{ minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming games from schedule sheet */}
      {!state.active && upcomingGames.length > 0 && (
        <div className="w-full mb-6">
          <div className="text-xs uppercase text-navy-400 font-semibold mb-2 px-1">From Sheet</div>
          <div className="space-y-2">
            {upcomingGames.map((game, i) => {
              const daysUntil = Math.ceil(
                (new Date(game.date) - new Date(today)) / (1000 * 60 * 60 * 24)
              );
              const dateLabel = daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `IN ${daysUntil} DAYS`;

              return (
                <button
                  key={i}
                  onClick={() => quickStartGame(game)}
                  className="w-full card p-4 text-left active:bg-navy-700/50 transition-colors border border-gold/20 hover:border-gold/40"
                  style={{ minHeight: '88px' }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gold uppercase">{dateLabel}</div>
                      <div className="font-semibold text-lg mt-1">vs {game.opponent}</div>
                    </div>
                    <div className="text-right text-xs text-navy-400">
                      <div>{game.date}</div>
                      {game.startTime && <div className="text-gold font-semibold">{game.startTime}</div>}
                    </div>
                  </div>
                  {game.field && (
                    <div className="text-xs text-navy-400 mt-2">{game.field}</div>
                  )}
                  <div className="text-xs text-gold mt-2 font-semibold">TAP TO START</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Last created game spectator link */}
      {createdGame && (
        <div className="w-full mb-4 card p-3 border border-gold/30 bg-gold/5">
          <div className="text-xs text-gold font-semibold mb-1">Game scheduled! Share parent link:</div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-navy-300 truncate flex-1 font-mono">
              {spectatorUrl(createdGame.spectatorId)}
            </span>
            <button
              onClick={() => copyLink(createdGame.spectatorId)}
              className="text-xs font-semibold text-gold border border-gold/40 rounded-lg px-2 py-1 active:bg-gold/20 flex-shrink-0 transition-colors"
              style={{ minHeight: 32 }}
            >
              {copiedLink === createdGame.spectatorId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setCreatedGame(null)}
            className="text-[10px] text-navy-500 mt-1 active:text-navy-300"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Schedule game form */}
      {showScheduleForm && (
        <div className="w-full mb-4 card p-4 border border-navy-600">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Schedule a Game</span>
            <button
              onClick={() => setShowScheduleForm(false)}
              className="text-navy-400 active:text-white text-xl leading-none"
              style={{ minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
          <form onSubmit={handleCreateScheduledGame} className="space-y-2">
            <input
              type="text"
              placeholder="Opponent name"
              value={formOpponent}
              onChange={e => setFormOpponent(e.target.value)}
              className="w-full text-sm"
              required
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="flex-1 text-sm"
              />
              <input
                type="time"
                value={formTime}
                onChange={e => setFormTime(e.target.value)}
                className="w-28 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Field / location"
              value={formField}
              onChange={e => setFormField(e.target.value)}
              className="w-full text-sm"
            />
            <button
              type="submit"
              disabled={!formOpponent.trim() || saving}
              className="btn-gold w-full py-3"
            >
              {saving ? 'Saving...' : 'Save & Get Link'}
            </button>
          </form>
        </div>
      )}

      {/* Flex spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="w-full flex flex-col gap-2">
        {!state.active && (
          <button
            onClick={() => navigate('/game/setup')}
            className="btn-gold w-full text-lg py-4"
          >
            New Game
          </button>
        )}
        {!state.active && (
          <button
            onClick={() => setShowScheduleForm(v => !v)}
            className="btn-primary w-full py-3"
          >
            {showScheduleForm ? 'Cancel' : '+ Schedule a Game'}
          </button>
        )}
        <button
          onClick={() => navigate('/roster')}
          className="btn-primary w-full py-3"
        >
          Manage Roster
        </button>
        <button
          onClick={() => navigate('/games')}
          className="btn-primary w-full py-3"
        >
          Past Games
        </button>
        <button
          onClick={() => navigate('/skills')}
          className="btn-primary w-full py-3"
        >
          Skill Development
        </button>
      </div>
    </div>
  );
}
