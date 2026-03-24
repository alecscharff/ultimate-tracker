import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { useGames } from '../hooks/useGames';
import { getPlayerStats } from '../utils/lineup';
import { softDeleteGame, updateGamePoints } from '../services/gameService';

export default function PastGames() {
  const navigate = useNavigate();
  const games = useGames();
  const players = usePlayers();
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingGameId, setEditingGameId] = useState(null);
  const [editedPoints, setEditedPoints] = useState([]);
  const [saving, setSaving] = useState(false);

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

  function startEditingPoints(game) {
    setEditingGameId(game.id);
    setEditedPoints((game.points || []).map(p => ({ ...p })));
  }

  function togglePointScorer(index) {
    setEditedPoints(prev => prev.map((p, i) =>
      i === index ? { ...p, scoredBy: p.scoredBy === 'us' ? 'them' : 'us' } : p
    ));
  }

  async function saveEditedPoints(game) {
    setSaving(true);
    try {
      await updateGamePoints(game.id, editedPoints);
      setEditingGameId(null);
      setEditedPoints([]);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGame(game) {
    await softDeleteGame(game.id);
    setDeleteTarget(null);
    setExpandedId(null);
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
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
          <h1 className="font-display text-2xl">PAST GAMES</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/games/add?mode=csv')} className="text-xs font-semibold text-gold/70 active:text-gold border border-gold/30 active:border-gold px-3 py-1.5 rounded-lg transition-colors" style={{ minHeight: '36px' }}>Import CSV</button>
          <button onClick={() => navigate('/games/add')} className="text-gold active:text-gold-light text-2xl leading-none px-1 py-2 font-bold" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
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

                  <div className="mb-4">
                    <button
                      onClick={() => setDeleteTarget(game)}
                      className="w-full text-xs py-2 rounded-lg font-semibold text-score-red/70 border border-score-red/30 active:bg-score-red/10 transition-colors"
                      style={{ minHeight: 36 }}
                    >
                      Delete Game
                    </button>
                  </div>

                  {/* Team Summary */}
                  <div className="text-xs uppercase text-navy-300 font-semibold mb-2">Team Summary</div>
                  {(() => {
                    const pts = game.points || [];
                    const totalGoals = pts.reduce((sum, pt) => sum + (pt.stats || []).filter(s => s.type === 'goal' || s.type === 'score').length, 0);
                    const totalAssists = pts.reduce((sum, pt) => sum + (pt.stats || []).filter(s => s.type === 'assist').length, 0);
                    const totalDs = pts.reduce((sum, pt) => sum + (pt.stats || []).filter(s => s.type === 'D' || s.type === 'd').length, 0);
                    const net = game.ourScore - game.theirScore;
                    return (
                      <div className="flex items-center justify-between bg-navy-900 rounded-lg px-3 py-2 mb-4">
                        <div className="flex gap-4 text-xs">
                          <div className="text-center"><div className="text-navy-400 mb-0.5">PF</div><div className="font-bold text-score-green">{game.ourScore}</div></div>
                          <div className="text-center"><div className="text-navy-400 mb-0.5">PA</div><div className="font-bold text-score-red">{game.theirScore}</div></div>
                          <div className="text-center"><div className="text-navy-400 mb-0.5">+/-</div><div className={`font-bold ${net >= 0 ? 'text-score-green' : 'text-score-red'}`}>{net >= 0 ? '+' : ''}{net}</div></div>
                          <div className="text-center"><div className="text-navy-400 mb-0.5">G</div><div className="font-bold text-white">{totalGoals}</div></div>
                          <div className="text-center"><div className="text-navy-400 mb-0.5">A</div><div className="font-bold text-white">{totalAssists}</div></div>
                          <div className="text-center"><div className="text-navy-400 mb-0.5">D</div><div className="font-bold text-white">{totalDs}</div></div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="text-xs uppercase text-navy-300 font-semibold mb-2">Player Stats</div>
                  {/* Column header */}
                  <div className="flex items-center text-[10px] text-navy-400 uppercase font-semibold px-3 py-1 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex-1 min-w-0">Player</span>
                      <span className="w-8 text-center flex-shrink-0"></span>
                      <span className="w-8 text-center flex-shrink-0"></span>
                    </div>
                    <div className="flex">
                      <span className="w-9 text-center">Pts</span>
                      <span className="w-9 text-center">G</span>
                      <span className="w-9 text-center">A</span>
                      <span className="w-9 text-center">D</span>
                      <span className="w-10 text-center">+/-</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {(game.checkedInPlayerIds || []).map(pid => {
                      const player = getPlayer(pid);
                      if (!player) return null;
                      const stats = getPlayerStats(pid, game.points || []);

                      return (
                        <div key={pid} className="flex items-center text-sm bg-navy-900 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium truncate flex-1 min-w-0">{player.name}</span>
                            <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded text-center w-8 flex-shrink-0 ${
                              player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                            }`}>{player.gender}</span>
                            <span className="text-[10px] text-navy-300 font-mono w-8 text-center flex-shrink-0">G{player.grade}</span>
                          </div>
                          <div className="flex text-xs">
                            <span className="w-9 text-center text-navy-300">{stats.pointsPlayed}</span>
                            <span className={`w-9 text-center ${stats.scores > 0 ? 'text-score-green font-semibold' : 'text-navy-600'}`}>{stats.scores}</span>
                            <span className={`w-9 text-center ${stats.assists > 0 ? 'text-gold font-semibold' : 'text-navy-600'}`}>{stats.assists}</span>
                            <span className={`w-9 text-center ${stats.ds > 0 ? 'text-navy-200 font-semibold' : 'text-navy-600'}`}>{stats.ds}</span>
                            <span className={`w-10 text-center font-semibold ${stats.plusMinus >= 0 ? 'text-score-green' : 'text-score-red'}`}>
                              {stats.plusMinus >= 0 ? '+' : ''}{stats.plusMinus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-4 mb-2">
                    <div className="text-xs uppercase text-navy-300 font-semibold">Point Log</div>
                    {editingGameId === game.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingGameId(null); setEditedPoints([]); }}
                          className="text-xs text-navy-400 active:text-white px-2 py-1 rounded-lg border border-navy-600"
                          style={{ minHeight: 28 }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEditedPoints(game)}
                          disabled={saving}
                          className="text-xs font-semibold text-navy-950 bg-gold active:bg-gold/80 px-3 py-1 rounded-lg"
                          style={{ minHeight: 28 }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingPoints(game)}
                        className="text-xs font-semibold text-gold/70 active:text-gold px-2 py-1 rounded-lg border border-gold/30 active:border-gold/60"
                        style={{ minHeight: 28 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingGameId === game.id && (
                    <div className="text-[10px] text-navy-400 mb-2">Tap a point to toggle who scored</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {(editingGameId === game.id ? editedPoints : (game.points || [])).map((pt, i) => (
                      editingGameId === game.id ? (
                        <button
                          key={i}
                          onClick={() => togglePointScorer(i)}
                          className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold active:scale-95 transition-transform ${
                            pt.scoredBy === 'us'
                              ? 'bg-score-green/40 text-score-green ring-1 ring-score-green/50'
                              : 'bg-score-red/40 text-score-red ring-1 ring-score-red/50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ) : (
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
                      )
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

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-navy-800 rounded-xl p-5 max-w-sm mx-4 w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-score-red">Delete Game?</p>
            <p className="text-xs text-navy-300 leading-relaxed">
              Delete the game vs {deleteTarget.opponent} ({deleteTarget.date})? This game will be removed from your history.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-primary flex-1" style={{ minHeight: 44 }}>
                Cancel
              </button>
              <button
                onClick={() => handleDeleteGame(deleteTarget)}
                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-score-red text-white active:bg-score-red/80 transition-colors"
                style={{ minHeight: 44 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
