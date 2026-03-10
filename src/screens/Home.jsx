import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getSetting } from '../services/settingsService';
import { extractSheetId, fetchSheetCSV, parseScheduleFromCSV } from '../utils/sheets';

export default function Home() {
  const navigate = useNavigate();
  const { state } = useGame();
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

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

        // Filter for today and future games
        const today = new Date().toISOString().split('T')[0];
        const upcoming = allGames.filter(g => g.date >= today);
        setUpcomingGames(upcoming.slice(0, 3)); // Show next 3 games
      } catch (err) {
        console.error('Failed to load schedule:', err);
        setUpcomingGames([]);
      } finally {
        setLoadingSchedule(false);
      }
    }

    loadSchedule();
  }, []);

  function quickStartGame(game) {
    // Store the game data and navigate to GameSetup
    // GameSetup will read these from localStorage or we can pass via state
    navigate('/game/setup', { state: { prefilledGame: game } });
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

      {/* Upcoming games from schedule */}
      {!state.active && upcomingGames.length > 0 && (
        <div className="w-full mb-6">
          <div className="text-xs uppercase text-navy-400 font-semibold mb-2 px-1">Next Up</div>
          <div className="space-y-2">
            {upcomingGames.map((game, i) => {
              const daysUntil = Math.ceil(
                (new Date(game.date) - new Date(new Date().toISOString().split('T')[0])) / (1000 * 60 * 60 * 24)
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
