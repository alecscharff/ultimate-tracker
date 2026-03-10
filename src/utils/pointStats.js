/**
 * Stat types used in the per-point attribution system.
 */
export const STAT_TYPES = [
  { key: 'D', label: 'D' },
  { key: 'assist', label: 'Ast' },
  { key: 'goal', label: 'Goal' },
];

/**
 * Get aggregated stats for a player across all points.
 * @param {string} playerId
 * @param {Array} points - array of point records from game state
 * @returns {{ goals: number, assists: number, ds: number, pointsPlayed: number }}
 */
export function getAggregatedPlayerStats(playerId, points) {
  let goals = 0, assists = 0, ds = 0, pointsPlayed = 0;
  for (const pt of points) {
    if (pt.lineup?.includes(playerId)) pointsPlayed++;
    for (const s of (pt.stats || [])) {
      if (s.playerId === playerId) {
        if (s.type === 'goal') goals++;
        else if (s.type === 'assist') assists++;
        else if (s.type === 'D') ds++;
      }
    }
  }
  return { goals, assists, ds, pointsPlayed };
}
