import { useMemo } from 'react';
import { getAggregatedPlayerStats } from '../utils/pointStats';
import { getDetailedPlayerStats } from '../utils/lineup';

function formatPlayingTime(milliseconds) {
  const minutes = Math.round(milliseconds / 60000);
  return `${minutes}m`;
}

export default function GameSummaryModal({ gameState, players, onConfirmEnd, onGoBack }) {
  const { opponent, ourScore, theirScore, checkedInPlayerIds, points } = gameState;

  const playerRows = useMemo(() => {
    const rows = checkedInPlayerIds.map(playerId => {
      const player = players.find(p => p.id === playerId);
      if (!player) return null;

      const aggStats = getAggregatedPlayerStats(playerId, points);
      const detailedStats = getDetailedPlayerStats(playerId, points);

      return {
        id: playerId,
        name: player.name,
        gender: player.gender,
        grade: player.grade,
        pointsPlayed: aggStats.pointsPlayed,
        totalPlayingTimeMs: detailedStats.totalPlayingTimeMs,
        ds: aggStats.ds,
        assists: aggStats.assists,
        goals: aggStats.goals,
      };
    }).filter(Boolean);

    rows.sort((a, b) => {
      if (b.pointsPlayed !== a.pointsPlayed) return b.pointsPlayed - a.pointsPlayed;
      return b.totalPlayingTimeMs - a.totalPlayingTimeMs;
    });

    return rows;
  }, [checkedInPlayerIds, players, points]);

  const weWon = ourScore > theirScore;
  const scoreColorClass = weWon ? 'text-score-green' : 'text-score-red';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-navy-900 border-t border-gold w-full max-w-lg rounded-t-2xl p-5 flex flex-col"
        style={{ maxHeight: '90vh', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="mb-2 text-center">
          <h2 className="font-display text-2xl font-bold text-gold">
            Game Over — {opponent}
          </h2>
        </div>

        {/* Final score */}
        <div className={`text-xl font-semibold text-center mb-4 ${scoreColorClass}`}>
          Marmots {ourScore} — {opponent} {theirScore}
        </div>

        {/* Roster table */}
        <div className="max-h-96 overflow-y-auto flex-1 min-h-0 rounded-lg border border-navy-700">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-navy-700 text-xs font-bold uppercase text-navy-300">
                <th className="px-3 py-2 min-w-[100px]">Name</th>
                <th className="px-2 py-2 text-center">Gen</th>
                <th className="px-2 py-2 text-center">Gr</th>
                <th className="px-2 py-2 text-center">Pts</th>
                <th className="px-2 py-2 text-center">Time</th>
                <th className="px-2 py-2 text-center">D</th>
                <th className="px-2 py-2 text-center">A</th>
                <th className="px-2 py-2 text-center">G</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`text-sm border-b border-navy-700 last:border-b-0 ${
                    index % 2 === 0 ? 'bg-navy-800' : 'bg-navy-800/70'
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-white truncate max-w-[120px]">
                    {row.name}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={`inline-block w-4 h-4 rounded-full ${
                        row.gender === 'gx'
                          ? 'bg-purple-500'
                          : 'bg-blue-500'
                      }`}
                      title={row.gender}
                    />
                  </td>
                  <td className="px-2 py-2 text-center text-navy-300">
                    G{row.grade}
                  </td>
                  <td className="px-2 py-2 text-center text-white font-medium">
                    {row.pointsPlayed}
                  </td>
                  <td className="px-2 py-2 text-center text-navy-300">
                    {formatPlayingTime(row.totalPlayingTimeMs)}
                  </td>
                  <td className="px-2 py-2 text-center text-white">
                    {row.ds}
                  </td>
                  <td className="px-2 py-2 text-center text-white">
                    {row.assists}
                  </td>
                  <td className="px-2 py-2 text-center text-white">
                    {row.goals}
                  </td>
                </tr>
              ))}
              {playerRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-navy-400 text-sm">
                    No players checked in.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onGoBack}
            className="btn-primary flex-1"
            style={{ minHeight: '44px' }}
          >
            Go Back
          </button>
          <button
            onClick={onConfirmEnd}
            className="btn-gold flex-1"
            style={{ minHeight: '44px' }}
          >
            Save &amp; Exit
          </button>
        </div>
      </div>
    </div>
  );
}
