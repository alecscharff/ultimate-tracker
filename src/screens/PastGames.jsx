import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { useGames } from '../hooks/useGames';
import { getPlayerStats } from '../utils/lineup';

export default function PastGames() {
  const navigate = useNavigate();
  const games = useGames();
  const players = usePlayers();
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const getPlayer = id => players.find(p => p.id === id);

  function generateGameCSV(game) {
    const lines = [];
    lines.push('GAME SUMMARY');
    lines.push(`Opponent,${game.opponent}`);
    lines.push(`Date,${game.date}`);
    lines.push(`Start Time,${game.startTime || ''}`);
    lines.push(`Field,${game.field || ''}`);
    lines.push(`Final Score,${game.ourScore} - ${game.theirScore}`);
    lines.push(`Result,${game.ourScore > game.theirScore ? 'Win' : game.ourScore < game.theirScore ? 'Loss' : 'Tie'}`);
    lines.push('');
    lines.push('PLAYER STATS');
    lines.push('Name,Gender,Grade,Points Played,+/-,Goals,Assists,Ds,Great Throws');
    (game.checkedInPlayerIds || []).forEach(pid => {
      const p = getPlayer(pid);
      if (!p) return;
      const s = getPlayerStats(pid, game.points || []);
      lines.push(`${p.name},${p.gender},${p.grade},${s.pointsPlayed},${s.plusMinus >= 0 ? '+' : ''}${s.plusMinus},${s.scores},${s.assists},${s.ds},${s.greatThrows}`);
    });
    lines.push('');
    lines.push('POINT LOG');
    lines.push('Point,Scored By,Players On Field');
    (game.points || []).forEach((pt, i) => {
      const playerNames = pt.lineup.map(id => getPlayer(id)?.name || 'Unknown').join('; ');
      lines.push(`${i + 1},${pt.scoredBy === 'us' ? 'Marmots' : game.opponent},${playerNames}`);
    });
    return lines.join('\n');
  }

  function handleCopyExport(game) {
    const csv = generateGameCSV(game);
    navigator.clipboard.writeText(csv).then(() => {
      setCopiedId(game.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleDownloadCSV(game) {
    const csv = generateGameCSV(game);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${game.date}_vs_${(game.opponent || 'unknown').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-dvh pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
        <h1 className="font-display text-2xl">PAST GAMES</h1>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {games.map(game => {
          const isExpanded = expandedId === game.id;
          const won = game.ourScore > game.theirScore;
          const tied = game.ourScore === game.theirScore;

          return (
            <div key={game.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : game.id)}
                className="w-full px-4 py-4 flex items-center justify-between text-left active:bg-navy-700/50"
                style={{ minHeight: '44px' }}
              >
                <div>
                  <div className="text-xs text-navy-300">{game.date} &middot; {game.field}</div>
                  <div className="font-semibold mt-0.5">vs {game.opponent}</div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-3xl ${won ? 'text-score-green' : tied ? 'text-gold' : 'text-score-red'}`}>
                    {game.ourScore} - {game.theirScore}
                  </div>
                  <div className={`text-xs font-semibold ${won ? 'text-score-green' : tied ? 'text-gold' : 'text-score-red'}`}>
                    {won ? 'WIN' : tied ? 'TIE' : 'LOSS'}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-navy-700 pt-3">
                  {/* Export buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => handleCopyExport(game)}
                      className="btn-primary flex-1 text-xs py-2"
                    >
                      {copiedId === game.id ? 'Copied!' : 'Copy for Sheets'}
                    </button>
                    <button
                      onClick={() => handleDownloadCSV(game)}
                      className="btn-primary flex-1 text-xs py-2"
                    >
                      Download CSV
                    </button>
                  </div>

                  <div className="text-xs uppercase text-navy-300 font-semibold mb-2">Player Stats</div>
                  <div className="space-y-1.5">
                    {(game.checkedInPlayerIds || []).map(pid => {
                      const player = getPlayer(pid);
                      if (!player) return null;
                      const stats = getPlayerStats(pid, game.points || []);

                      return (
                        <div key={pid} className="flex items-center justify-between text-sm bg-navy-900 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{player.name}</span>
                            <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${
                              player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                            }`}>{player.gender}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-navy-300">
                            <span>{stats.pointsPlayed} pts</span>
                            {stats.scores > 0 && <span className="text-score-green">{stats.scores} goals</span>}
                            {stats.assists > 0 && <span className="text-gold">{stats.assists} ast</span>}
                            {stats.ds > 0 && <span className="text-navy-200">{stats.ds} D</span>}
                            <span className={stats.plusMinus >= 0 ? 'text-score-green' : 'text-score-red'}>
                              {stats.plusMinus >= 0 ? '+' : ''}{stats.plusMinus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-xs uppercase text-navy-300 font-semibold mt-4 mb-2">Point Log</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(game.points || []).map((pt, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                          pt.scoredBy === 'us'
                            ? 'bg-score-green/20 text-score-green'
                            : 'bg-score-red/20 text-score-red'
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {games.length === 0 && (
          <div className="text-center text-navy-400 py-16">
            No games played yet.
          </div>
        )}
      </div>
    </div>
  );
}
