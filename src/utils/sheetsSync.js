import db from '../db';
import { getPlayerStats } from './lineup';

// Default script URL — can be overridden per-device via Roster > Set up results sync
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkaXiGQD4QWrV1NSqh1yr_JRC1HZWZdMM3-evszlehgAJnd19BzvPXLsjQ_TF9HRiv/exec';

export async function syncGameToSheet(state, players) {
  const setting = await db.settings.get('scriptUrl').catch(() => null);
  const scriptUrl = setting?.value || DEFAULT_SCRIPT_URL;
  if (!scriptUrl || scriptUrl === 'https://script.google.com/macros/s/AKfycbxkaXiGQD4QWrV1NSqh1yr_JRC1HZWZdMM3-evszlehgAJnd19BzvPXLsjQ_TF9HRiv/exec') return { skipped: true };

  const playerStats = (state.checkedInPlayerIds || []).flatMap(pid => {
    const p = players.find(pl => pl.id === pid);
    if (!p) return [];
    const s = getPlayerStats(pid, state.points);
    return [{
      name: p.name,
      gender: p.gender,
      grade: p.grade,
      pointsPlayed: s.pointsPlayed,
      plusMinus: s.plusMinus,
      scores: s.scores,
      assists: s.assists,
      ds: s.ds,
      greatThrows: s.greatThrows,
    }];
  });

  const payload = {
    date: state.date,
    opponent: state.opponent,
    field: state.field,
    startTime: state.startTime,
    ourScore: state.ourScore,
    theirScore: state.theirScore,
    result: state.ourScore > state.theirScore ? 'Win' : state.ourScore < state.theirScore ? 'Loss' : 'Tie',
    totalPoints: (state.points || []).length,
    playerStats,
  };

  const response = await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Sync failed');
  return { success: true };
}
