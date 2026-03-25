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
          // Support both conventions: 'score'/'goal' and 'd'/'D'
          if (s.type === 'score' || s.type === 'goal') scores++;
          if (s.type === 'assist') assists++;
          if (s.type === 'd' || s.type === 'D') ds++;
          if (s.type === 'greatThrow') greatThrows++;
        }
      });
    }
    if (pt.scorer === playerId) scores++;
  });

  return { pointsPlayed, minutesPlayed, lastPointNumber, scores, assists, ds, greatThrows, plusMinus };
}

/**
 * Compute per-player bench/playing stats for display in the UI.
 * Returns an object keyed by playerId with:
 * - pointsPlayed: number
 * - totalPlayingTimeMs: number
 * - lastPointEndedAt: timestamp or null
 * - benchTimeMs: ms since their last point ended (relative to `now`)
 * - pointsSinceLastPlay: number of points since they last played
 */
export function getDetailedPlayerStats(playerId, points, now = Date.now()) {
  let pointsPlayed = 0;
  let totalPlayingTimeMs = 0;
  let lastPointEndedAt = null;
  let lastPlayedIndex = -1;

  points.forEach((pt, i) => {
    const segments = pt.timeoutSubs && pt.timeoutSubs.length > 0 ? pt.timeoutSubs : null;
    if (segments) {
      segments.forEach(seg => {
        if (seg.lineup && seg.lineup.includes(playerId)) {
          pointsPlayed++;
          lastPlayedIndex = i;
          if (seg.startedAt && seg.endedAt) {
            totalPlayingTimeMs += seg.endedAt - seg.startedAt;
            lastPointEndedAt = seg.endedAt;
          }
        }
      });
    } else {
      if (pt.lineup && pt.lineup.includes(playerId)) {
        pointsPlayed++;
        lastPlayedIndex = i;
        if (pt.startedAt && pt.endedAt) {
          totalPlayingTimeMs += pt.endedAt - pt.startedAt;
          lastPointEndedAt = pt.endedAt;
        }
      }
    }
  });

  const benchTimeMs = lastPointEndedAt !== null ? now - lastPointEndedAt : now;
  const pointsSinceLastPlay = lastPlayedIndex === -1
    ? points.length
    : points.length - 1 - lastPlayedIndex;

  return { pointsPlayed, totalPlayingTimeMs, lastPointEndedAt, benchTimeMs, pointsSinceLastPlay };
}

/** Build a map of how many times each pair of players has been in the same lineup. */
function getPairCounts(points) {
  const counts = {};
  for (const pt of points) {
    const lineup = pt.lineup || [];
    for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
        const key = [lineup[i], lineup[j]].sort().join('|');
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  return counts;
}

/** Sum of co-occurrence counts for all pairs in a proposed lineup. */
function lineupPairScore(ids, pairCounts) {
  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = [ids[i], ids[j]].sort().join('|');
      total += pairCounts[key] || 0;
    }
  }
  return total;
}

export function suggestLineup(players, checkedInIds, ratio, points, equalizeBy = 'points') {
  const available = players.filter(p => checkedInIds.includes(p.id));
  if (available.length === 0) return [];

  const detailedStats = {};
  available.forEach(p => {
    detailedStats[p.id] = getDetailedPlayerStats(p.id, points);
  });

  const bxPlayers = available.filter(p => p.gender === 'bx');
  const gxPlayers = available.filter(p => p.gender === 'gx');

  // Primary: fewest points played (or least time played)
  // Secondary: longest bench time (most rested) — higher benchTimeMs sorts first
  // Tertiary: grade diversity handled after initial selection
  const sortFn = (a, b) => {
    const sa = detailedStats[a.id];
    const sb = detailedStats[b.id];

    if (equalizeBy === 'time') {
      const timeDiff = sa.totalPlayingTimeMs - sb.totalPlayingTimeMs;
      if (timeDiff !== 0) return timeDiff;
    } else {
      const ptsDiff = sa.pointsPlayed - sb.pointsPlayed;
      if (ptsDiff !== 0) return ptsDiff;
    }

    // Secondary: most rested (longest bench time) first
    return sb.benchTimeMs - sa.benchTimeMs;
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

  // Tertiary: grade diversity — if all same grade and we have alternatives, swap the last one
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

  // Quaternary: variety — try swapping any selected player with a near-equivalent bench player
  // to reduce repeat pairings. Only applies after ≥5 points so there's meaningful history.
  if (points.length >= 5) {
    const pairCounts = getPairCounts(points);
    // Build extended pool: top N+2 per gender (the alternatives we'd consider)
    const bxPool = bxPlayers.slice(0, bxNeeded + 2);
    const gxPool = gxPlayers.slice(0, gxNeeded + 2);
    const altPool = [...bxPool, ...gxPool];

    let bestScore = lineupPairScore(selected.map(p => p.id), pairCounts);
    let bestSelected = [...selected];

    for (let i = 0; i < selected.length; i++) {
      const out = selected[i];
      const outMetric = equalizeBy === 'time'
        ? detailedStats[out.id].totalPlayingTimeMs
        : detailedStats[out.id].pointsPlayed;
      const selectedIds = new Set(bestSelected.map(p => p.id));

      // Candidates: same gender, not already selected, within 1 point (or exact time) of out
      const alts = altPool.filter(p => {
        if (selectedIds.has(p.id) || p.gender !== out.gender) return false;
        const m = equalizeBy === 'time'
          ? detailedStats[p.id].totalPlayingTimeMs
          : detailedStats[p.id].pointsPlayed;
        return equalizeBy === 'time' ? m === outMetric : m <= outMetric + 1;
      });

      for (const alt of alts) {
        const testSelected = [...bestSelected];
        testSelected[i] = alt;
        const testScore = lineupPairScore(testSelected.map(p => p.id), pairCounts);
        if (testScore < bestScore) {
          bestScore = testScore;
          bestSelected = testSelected;
        }
      }
    }
    selected = bestSelected;
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

/**
 * Generate algorithmic lineup previews for N future points.
 * Returns array of { pointNumber, ratio: {bx, gx}, lineup: [playerId] }
 */
export function previewFutureLineups(players, checkedInIds, ratioPattern, ratioIndex, points, count = 5) {
  const previews = [];
  let simPoints = [...points];
  let idx = ratioIndex;
  const startingPointNumber = points.length + 1;

  for (let i = 0; i < count; i++) {
    const ratio = ratioPattern[idx % ratioPattern.length];
    const lineup = suggestLineup(players, checkedInIds, ratio, simPoints);
    previews.push({
      pointNumber: startingPointNumber + i,
      ratio,
      lineup,
    });
    simPoints = [
      ...simPoints,
      { lineup, scoredBy: 'us', startedAt: null, endedAt: null, stats: [] },
    ];
    idx++;
  }

  return previews;
}
