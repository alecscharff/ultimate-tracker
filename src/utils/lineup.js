export function getPlayerStats(playerId, points) {
  let pointsPlayed = 0;
  let minutesPlayed = 0;
  let lastPointNumber = -1;
  let scores = 0;
  let assists = 0;
  let ds = 0;
  let greatThrows = 0;
  let plusMinus = 0;

  points.forEach((pt, i) => {
    if (pt.lineup.includes(playerId)) {
      pointsPlayed++;
      lastPointNumber = i;
      if (pt.startedAt && pt.endedAt) {
        minutesPlayed += (pt.endedAt - pt.startedAt) / 60000;
      }
      plusMinus += pt.scoredBy === 'us' ? 1 : -1;
    }
    if (pt.stats) {
      pt.stats.forEach(s => {
        if (s.playerId === playerId) {
          if (s.type === 'score') scores++;
          if (s.type === 'assist') assists++;
          if (s.type === 'd') ds++;
          if (s.type === 'greatThrow') greatThrows++;
        }
      });
    }
    if (pt.scorer === playerId) scores++;
  });

  return { pointsPlayed, minutesPlayed, lastPointNumber, scores, assists, ds, greatThrows, plusMinus };
}

export function suggestLineup(players, checkedInIds, ratio, points, equalizeBy = 'points') {
  const available = players.filter(p => checkedInIds.includes(p.id));
  if (available.length === 0) return [];

  const stats = {};
  available.forEach(p => {
    stats[p.id] = getPlayerStats(p.id, points);
  });

  const bxPlayers = available.filter(p => p.gender === 'bx');
  const gxPlayers = available.filter(p => p.gender === 'gx');

  const sortKey = equalizeBy === 'time' ? 'minutesPlayed' : 'pointsPlayed';
  const sortFn = (a, b) => {
    const diff = stats[a.id][sortKey] - stats[b.id][sortKey];
    if (diff !== 0) return diff;
    return stats[a.id].lastPointNumber - stats[b.id].lastPointNumber;
  };

  bxPlayers.sort(sortFn);
  gxPlayers.sort(sortFn);

  const bxNeeded = Math.min(ratio.bx, bxPlayers.length);
  const gxNeeded = Math.min(ratio.gx, gxPlayers.length);

  let selected = [
    ...bxPlayers.slice(0, bxNeeded),
    ...gxPlayers.slice(0, gxNeeded),
  ];

  // Fill remaining spots if one gender is short
  const totalNeeded = ratio.bx + ratio.gx;
  if (selected.length < totalNeeded) {
    const selectedIds = new Set(selected.map(p => p.id));
    const remaining = available
      .filter(p => !selectedIds.has(p.id))
      .sort(sortFn);
    while (selected.length < totalNeeded && remaining.length > 0) {
      selected.push(remaining.shift());
    }
  }

  // Grade diversity: if all same grade and we have alternatives, swap the last one
  if (selected.length >= 3) {
    const grades = selected.map(p => p.grade);
    const uniqueGrades = new Set(grades);
    if (uniqueGrades.size === 1) {
      const selectedIds = new Set(selected.map(p => p.id));
      const lastPlayer = selected[selected.length - 1];
      const bench = available
        .filter(p => !selectedIds.has(p.id) && p.grade !== grades[0] && p.gender === lastPlayer.gender)
        .sort(sortFn);
      if (bench.length > 0) {
        selected[selected.length - 1] = bench[0];
      }
    }
  }

  return selected.map(p => p.id);
}

export function previewLineups(players, checkedInIds, ratioPattern, ratioIndex, points, count = 2) {
  const previews = [];
  let simPoints = [...points];
  let idx = ratioIndex;

  for (let i = 0; i < count; i++) {
    const ratio = ratioPattern[idx % ratioPattern.length];
    const lineup = suggestLineup(players, checkedInIds, ratio, simPoints);
    previews.push({ ratio, lineup });
    simPoints = [...simPoints, { lineup, scoredBy: 'us', startedAt: null, endedAt: null, stats: [] }];
    idx++;
  }

  return previews;
}
