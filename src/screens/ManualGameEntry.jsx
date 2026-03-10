import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usePlayers } from '../hooks/usePlayers';
import { getPlayerStats } from '../utils/lineup';
import StatAttribution from '../components/StatAttribution';

const RATIO_PRESETS = [
  { label: '3bx / 2gx', patterns: [{ bx: 3, gx: 2 }] },
  { label: '2bx / 3gx', patterns: [{ bx: 2, gx: 3 }] },
  { label: 'Alt 3/2 & 2/3', patterns: [{ bx: 3, gx: 2 }, { bx: 2, gx: 3 }] },
  { label: '4bx / 1gx', patterns: [{ bx: 4, gx: 1 }] },
  { label: '1bx / 4gx', patterns: [{ bx: 1, gx: 4 }] },
  { label: '5bx / 0gx', patterns: [{ bx: 5, gx: 0 }] },
  { label: '0bx / 5gx', patterns: [{ bx: 0, gx: 5 }] },
];

export default function ManualGameEntry() {
  const navigate = useNavigate();
  const players = usePlayers();

  // Shared setup data
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [field, setField] = useState('');
  const [checkedInPlayerIds, setCheckedInPlayerIds] = useState(new Set());

  // Step control
  const [step, setStep] = useState(1); // 1=setup, 2=points, 3=review

  // Points entry
  const [points, setPoints] = useState([]);
  const [currentLineup, setCurrentLineup] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Entry mode
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' | 'detailed' | 'csv'
  const [expandedPointIndex, setExpandedPointIndex] = useState(null);

  // CSV import state
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState(null); // { points, ourScore, theirScore, matched, unmatched }
  const [csvError, setCsvError] = useState('');

  // Handlers
  function togglePlayer(id) {
    setCheckedInPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLineupPlayer(id) {
    setCurrentLineup(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllLineup() {
    setCurrentLineup(new Set(checkedInPlayerIds));
  }

  function startStep2() {
    if (!opponent.trim() || checkedInPlayerIds.size < 5) return;
    setCurrentLineup(new Set()); // default empty
    setStep(2);
  }

  function handleAddPoint(scoredBy, stats) {
    const point = {
      number: points.length + 1,
      lineup: [...currentLineup],
      scoredBy,
      stats: stats || [],
      midPointSubs: [],
      startedAt: null,
      endedAt: null,
    };
    setPoints([...points, point]);
    setCurrentLineup(new Set()); // reset to empty for next point
  }

  function handleUndoLastPoint() {
    if (points.length === 0) return;
    setPoints(points.slice(0, -1));
  }

  function handleAddStat(pointIndex, playerId, statType) {
    setPoints(prev => {
      const updated = [...prev];
      const pt = updated[pointIndex];
      pt.stats = pt.stats || [];
      pt.stats.push({ playerId, type: statType });
      return updated;
    });
  }

  function handleRemoveStat(pointIndex, playerId, statType) {
    setPoints(prev => {
      const updated = [...prev];
      const pt = updated[pointIndex];
      pt.stats = (pt.stats || []).filter(s => !(s.playerId === playerId && s.type === statType));
      return updated;
    });
  }

  function handleQuickAddPoint(scoredBy) {
    const point = {
      number: points.length + 1,
      lineup: [],
      scoredBy,
      stats: [],
      midPointSubs: [],
      startedAt: null,
      endedAt: null,
    };
    setPoints(prev => [...prev, point]);
    setExpandedPointIndex(null);
  }

  function handleTogglePointLineupPlayer(pointIndex, playerId) {
    setPoints(prev => {
      const updated = [...prev];
      const pt = { ...updated[pointIndex] };
      const lineupSet = new Set(pt.lineup);
      if (lineupSet.has(playerId)) lineupSet.delete(playerId);
      else lineupSet.add(playerId);
      pt.lineup = [...lineupSet];
      updated[pointIndex] = pt;
      return updated;
    });
  }

  function handleSelectAllPointLineup(pointIndex) {
    setPoints(prev => {
      const updated = [...prev];
      updated[pointIndex] = { ...updated[pointIndex], lineup: [...checkedInPlayerIds] };
      return updated;
    });
  }

  function handleClearPointLineup(pointIndex) {
    setPoints(prev => {
      const updated = [...prev];
      updated[pointIndex] = { ...updated[pointIndex], lineup: [] };
      return updated;
    });
  }

  function parseCSV(text) {
    // Split into rows, handle \r\n and \n
    const rawRows = text.trim().split(/\r?\n/);
    // Parse each row respecting quoted fields
    return rawRows.map(row => {
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (inQuotes) {
          if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else current += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === ',') { cells.push(current.trim()); current = ''; }
          else current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  }

  function parseCellStats(cell) {
    // Returns { played: bool, stats: [{type}] }
    const v = cell.trim().toUpperCase();
    if (!v || v === '0' || v === 'N' || v === 'NO' || v === 'FALSE') return { played: false, stats: [] };
    const stats = [];
    if (v.includes('G')) stats.push({ type: 'goal' });
    if (v.includes('A')) stats.push({ type: 'assist' });
    if (v.includes('D')) stats.push({ type: 'D' });
    return { played: true, stats };
  }

  function handleParseCSV() {
    setCsvError('');
    setCsvPreview(null);
    if (!csvText.trim()) { setCsvError('Paste your CSV data first.'); return; }

    const rows = parseCSV(csvText);
    if (rows.length < 2) { setCsvError('Need at least a Scored row and one player row.'); return; }

    // Find scored row (first col matches /^score/i or /^result/i)
    const scoredRowIdx = rows.findIndex(r => /^score/i.test(r[0]) || /^result/i.test(r[0]));
    if (scoredRowIdx === -1) { setCsvError('Could not find "Scored" row. Make sure one row starts with "Scored" or "Score".'); return; }

    const scoredRow = rows[scoredRowIdx];
    // Point columns start at index 1
    const numPoints = scoredRow.length - 1;
    if (numPoints < 1) { setCsvError('No points found in the Scored row.'); return; }

    // Parse scored-by for each point
    const scoredBy = [];
    for (let i = 1; i <= numPoints; i++) {
      const v = (scoredRow[i] || '').trim().toLowerCase();
      if (/^(us|we|our|u|1|w|home)$/.test(v)) scoredBy.push('us');
      else if (/^(them|they|their|t|2|opp|opponent|away)$/.test(v)) scoredBy.push('them');
      else { setCsvError(`Unrecognized value "${scoredRow[i]}" in Scored row at point ${i}. Use "us"/"them".`); return; }
    }

    // Parse player rows (skip header-ish rows: scored row, and rows where first col is empty or "player" or numbers)
    const matched = [];
    const unmatched = [];

    const playerRows = rows.filter((r, idx) => {
      if (idx === scoredRowIdx) return false;
      const first = (r[0] || '').trim();
      if (!first) return false;
      if (/^(player|name|point|\d+)$/i.test(first)) return false;
      return true;
    });

    if (playerRows.length === 0) { setCsvError('No player rows found. Expected rows with player names followed by point data.'); return; }

    for (const row of playerRows) {
      const nameRaw = row[0].trim();
      // Match to roster (case-insensitive, partial match)
      const player = players.find(p =>
        p.name.toLowerCase() === nameRaw.toLowerCase() ||
        p.name.toLowerCase().includes(nameRaw.toLowerCase()) ||
        nameRaw.toLowerCase().includes(p.name.toLowerCase())
      );
      if (!player) { unmatched.push(nameRaw); continue; }

      // Parse each point cell
      const pointData = [];
      for (let i = 1; i <= numPoints; i++) {
        pointData.push(parseCellStats(row[i] || ''));
      }
      matched.push({ player, pointData });
    }

    // Build points array
    const builtPoints = scoredBy.map((sb, i) => {
      const lineup = [];
      const stats = [];
      for (const { player, pointData } of matched) {
        const pd = pointData[i];
        if (pd && pd.played) {
          lineup.push(player.id);
          for (const s of pd.stats) stats.push({ playerId: player.id, type: s.type });
        }
      }
      return {
        number: i + 1,
        lineup,
        scoredBy: sb,
        stats,
        midPointSubs: [],
        startedAt: null,
        endedAt: null,
      };
    });

    const ourScore = builtPoints.filter(p => p.scoredBy === 'us').length;
    const theirScore = builtPoints.filter(p => p.scoredBy === 'them').length;
    setCsvPreview({ points: builtPoints, ourScore, theirScore, matched, unmatched });
  }

  function handleLoadCSV() {
    if (!csvPreview) return;
    // Auto check-in all matched players
    setCheckedInPlayerIds(new Set(csvPreview.matched.map(m => m.player.id)));
    setPoints(csvPreview.points);
    setCsvPreview(null);
    setCsvText('');
    setEntryMode('quick');
  }

  async function saveGame() {
    setSaving(true);
    try {
      const id = Date.now();
      const ourScore = points.filter(p => p.scoredBy === 'us').length;
      const theirScore = points.filter(p => p.scoredBy === 'them').length;

      const gameRecord = {
        id,
        opponent: opponent.trim(),
        date,
        startTime,
        field: field.trim(),
        ourScore,
        theirScore,
        points,
        checkedInPlayerIds: [...checkedInPlayerIds],
        ratioPattern: [{ bx: 3, gx: 2 }], // default
        gameStartedAt: null,
        endedAt: Date.now(),
        status: 'completed',
      };

      await setDoc(doc(db, 'games', String(id)), gameRecord);
      navigate('/games');
    } catch (err) {
      console.error('Failed to save game:', err);
      alert('Failed to save game. Please try again.');
      setSaving(false);
    }
  }

  // ===== STEP 1: SETUP =====
  if (step === 1) {
    const bxCount = [...checkedInPlayerIds].filter(id => players.find(p => p.id === id)?.gender === 'bx').length;
    const gxCount = [...checkedInPlayerIds].filter(id => players.find(p => p.id === id)?.gender === 'gx').length;

    return (
      <div className="min-h-dvh pb-8">
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/games')} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
          <h1 className="font-display text-2xl">ADD PAST GAME</h1>
        </div>

        <div className="px-4 py-4 space-y-4">
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

          {/* Player check-in */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase text-navy-300 font-semibold">
                Players Present ({checkedInPlayerIds.size})
              </label>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setCheckedInPlayerIds(new Set(players.map(p => p.id)))} className="text-navy-300 underline active:text-white py-1 px-2" style={{ minHeight: '36px' }}>All</button>
                <button onClick={() => setCheckedInPlayerIds(new Set())} className="text-navy-300 underline active:text-white py-1 px-2" style={{ minHeight: '36px' }}>None</button>
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
                    checkedInPlayerIds.has(player.id)
                      ? 'border-gold/50 bg-navy-800'
                      : 'border-navy-700/50 bg-navy-800/40 opacity-50'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                      checkedInPlayerIds.has(player.id)
                        ? 'border-gold bg-gold'
                        : 'border-navy-600'
                    }`}>
                      {checkedInPlayerIds.has(player.id) && (
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

        {/* Next button */}
        <div className="px-4 pt-2">
          <button
            onClick={startStep2}
            disabled={!opponent.trim() || checkedInPlayerIds.size < 5}
            className="btn-gold w-full text-lg py-5"
          >
            Next: Enter Points
          </button>
          {checkedInPlayerIds.size > 0 && checkedInPlayerIds.size < 5 && (
            <p className="text-score-red text-xs text-center mt-2">Need at least 5 players checked in</p>
          )}
        </div>
      </div>
    );
  }

  // ===== STEP 2: POINT-BY-POINT ENTRY =====
  if (step === 2) {
    const ourScore = points.filter(p => p.scoredBy === 'us').length;
    const theirScore = points.filter(p => p.scoredBy === 'them').length;

    return (
      <div className="min-h-dvh flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep(1)} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
          <h1 className="font-display text-2xl">
            <span className="text-score-green">{ourScore}</span>
            <span className="text-navy-300"> - </span>
            <span className="text-score-red">{theirScore}</span>
          </h1>
          <div className="ml-auto flex bg-navy-800 rounded-lg p-0.5 border border-navy-700">
            <button
              onClick={() => setEntryMode('quick')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                entryMode === 'quick' ? 'bg-gold text-navy-950' : 'text-navy-300 active:text-white'
              }`}
            >
              Quick
            </button>
            <button
              onClick={() => setEntryMode('detailed')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                entryMode === 'detailed' ? 'bg-gold text-navy-950' : 'text-navy-300 active:text-white'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setEntryMode('csv')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                entryMode === 'csv' ? 'bg-gold text-navy-950' : 'text-navy-300 active:text-white'
              }`}
            >
              CSV
            </button>
          </div>
        </div>

        {entryMode === 'quick' ? (
          <div className="flex flex-col flex-1">
            {/* Point list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pb-40 space-y-2">
              {points.length === 0 && (
                <div className="text-center text-navy-400 py-12 text-sm">
                  Tap "We Scored" or "They Scored" to add points
                </div>
              )}
              {points.map((pt, i) => (
                <QuickEntryPointRow
                  key={i}
                  point={pt}
                  index={i}
                  isExpanded={expandedPointIndex === i}
                  onToggleExpand={() => setExpandedPointIndex(expandedPointIndex === i ? null : i)}
                  checkedInPlayerIds={checkedInPlayerIds}
                  players={players}
                  onTogglePlayer={handleTogglePointLineupPlayer}
                  onSelectAll={() => handleSelectAllPointLineup(i)}
                  onClear={() => handleClearPointLineup(i)}
                  onAddStat={handleAddStat}
                  onRemoveStat={handleRemoveStat}
                />
              ))}
            </div>

            {/* Sticky bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-navy-700 px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickAddPoint('us')}
                  className="bg-score-green text-white py-5 rounded-xl font-bold text-lg active:bg-score-green/80"
                  style={{ minHeight: '56px' }}
                >
                  We Scored
                </button>
                <button
                  onClick={() => handleQuickAddPoint('them')}
                  className="bg-score-red text-white py-5 rounded-xl font-bold text-lg active:bg-score-red/80"
                  style={{ minHeight: '56px' }}
                >
                  They Scored
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUndoLastPoint}
                  disabled={points.length === 0}
                  className="btn-primary flex-1 py-3 text-sm disabled:opacity-50"
                >
                  Undo Last
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-gold flex-1 py-3 text-sm"
                >
                  Done ({points.length} pts)
                </button>
              </div>
            </div>
          </div>
        ) : entryMode === 'csv' ? (
          /* CSV paste mode */
          <div className="px-4 py-4 pb-8 space-y-4">
            <div>
              <p className="text-xs text-navy-300 leading-relaxed mb-3">
                Paste a CSV where <span className="text-gold font-semibold">columns = points</span>, one row for scored (us/them), and one row per player. Cell values: <span className="font-mono text-navy-200">1</span>=played, <span className="font-mono text-navy-200">G</span>=goal, <span className="font-mono text-navy-200">A</span>=assist, <span className="font-mono text-navy-200">D</span>=D, <span className="font-mono text-navy-200">GA</span>=goal+assist, <span className="font-mono text-navy-200">0</span>=sat out.
              </p>
              <div className="card p-3 mb-2 bg-navy-900 font-mono text-[11px] text-navy-300 leading-relaxed whitespace-pre overflow-x-auto">
{`,1,2,3,4,5
Scored,us,them,us,them,us
Alex,G,0,1,0,A
Jordan,1,A,0,1,1
Sam,0,1,D,0,1`}
              </div>
            </div>

            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setCsvPreview(null); setCsvError(''); }}
              placeholder="Paste CSV here..."
              className="w-full font-mono text-sm bg-navy-800 border border-navy-600 rounded-lg px-3 py-3 text-white placeholder-navy-500 focus:outline-none focus:border-gold resize-none"
              rows={8}
            />

            {csvError && (
              <p className="text-xs text-score-red leading-relaxed">{csvError}</p>
            )}

            {!csvPreview ? (
              <button
                onClick={handleParseCSV}
                disabled={!csvText.trim()}
                className="btn-gold w-full py-4 disabled:opacity-50"
              >
                Parse CSV
              </button>
            ) : (
              <div className="space-y-3">
                {/* Preview summary */}
                <div className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase text-navy-400 font-semibold">Preview</span>
                    <span className="font-display text-xl">
                      <span className="text-score-green">{csvPreview.ourScore}</span>
                      <span className="text-navy-400"> - </span>
                      <span className="text-score-red">{csvPreview.theirScore}</span>
                    </span>
                  </div>
                  <div className="text-xs text-navy-300">{csvPreview.points.length} points parsed</div>

                  {csvPreview.matched.length > 0 && (
                    <div>
                      <div className="text-xs text-score-green font-semibold mb-1">Matched ({csvPreview.matched.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {csvPreview.matched.map(({ player }) => (
                          <span key={player.id} className="text-[11px] bg-score-green/10 text-score-green border border-score-green/30 px-2 py-0.5 rounded-full">
                            {player.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {csvPreview.unmatched.length > 0 && (
                    <div>
                      <div className="text-xs text-score-red font-semibold mb-1">Not found in roster ({csvPreview.unmatched.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {csvPreview.unmatched.map(name => (
                          <span key={name} className="text-[11px] bg-score-red/10 text-score-red border border-score-red/30 px-2 py-0.5 rounded-full">
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-navy-400 mt-1">These players won't be included. Fix names in your CSV to match roster names, or add them to the roster first.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setCsvPreview(null)} className="btn-primary flex-1 py-3">
                    Re-edit
                  </button>
                  <button onClick={handleLoadCSV} className="btn-gold flex-1 py-3">
                    Load {csvPreview.points.length} Points
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Detailed mode — existing UI */
          <div className="px-4 py-4 pb-8 space-y-4">
            {/* Lineup selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase text-navy-300 font-semibold">
                  Select Lineup for Next Point ({currentLineup.size})
                </label>
                <button onClick={selectAllLineup} className="text-xs text-navy-300 underline active:text-white">
                  All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...checkedInPlayerIds].map(id => {
                  const player = players.find(p => p.id === id);
                  if (!player) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => toggleLineupPlayer(id)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        currentLineup.has(id)
                          ? 'bg-gold text-navy-950'
                          : 'bg-navy-800 text-navy-300 border border-navy-700'
                      }`}
                      style={{ minHeight: '36px' }}
                    >
                      {player.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentLineup.size > 0 && (
              <PointScoreSection
                onScored={(scoredBy, stats) => handleAddPoint(scoredBy, stats)}
                lineupPlayerIds={[...currentLineup]}
                players={players}
              />
            )}

            {points.length > 0 && (
              <div>
                <label className="text-xs uppercase text-navy-300 font-semibold mb-2 block">
                  Point History ({points.length})
                </label>
                <div className="space-y-2">
                  {points.map((pt, i) => (
                    <div key={i} className="card px-4 py-3 bg-navy-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">
                          Point {i + 1}: <span className={pt.scoredBy === 'us' ? 'text-score-green' : 'text-score-red'}>
                            {pt.scoredBy === 'us' ? 'Ours' : 'Theirs'}
                          </span>
                        </div>
                        <div className="text-xs text-navy-400">{pt.lineup.length} players</div>
                      </div>
                      <div className="text-xs text-navy-400">
                        {pt.lineup.map(id => players.find(p => p.id === id)?.name || 'Unknown').join(', ')}
                      </div>
                      {pt.stats && pt.stats.length > 0 && (
                        <div className="text-xs text-navy-400 mt-1">
                          Stats: {pt.stats.map(s => `${players.find(p => p.id === s.playerId)?.name || 'Unknown'} (${s.type})`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button onClick={() => setStep(3)} className="btn-gold w-full text-lg py-5">
                Finished Entering Points
              </button>
              <button
                onClick={handleUndoLastPoint}
                disabled={points.length === 0}
                className="btn-primary w-full text-lg py-3 disabled:opacity-50"
              >
                Undo Last Point
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== STEP 3: REVIEW & SAVE =====
  if (step === 3) {
    const ourScore = points.filter(p => p.scoredBy === 'us').length;
    const theirScore = points.filter(p => p.scoredBy === 'them').length;

    return (
      <div className="min-h-dvh pb-8">
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep(2)} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
          <h1 className="font-display text-2xl">REVIEW</h1>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Summary */}
          <div className="card p-4">
            <div className="text-xs text-navy-400 mb-1">{date}</div>
            <div className="font-semibold text-lg mb-2">vs {opponent}</div>
            <div className="text-3xl font-display mb-2">
              <span className="text-score-green">{ourScore}</span> - <span className="text-score-red">{theirScore}</span>
            </div>
            {field && <div className="text-sm text-navy-300">{field}</div>}
          </div>

          {/* Player stats */}
          <div>
            <label className="text-xs uppercase text-navy-300 font-semibold mb-2 block">
              Player Stats
            </label>
            <div className="space-y-1.5">
              {[...checkedInPlayerIds].map(pid => {
                const player = players.find(p => p.id === pid);
                if (!player) return null;
                const stats = getPlayerStats(pid, points);

                return (
                  <div key={pid} className="flex items-center justify-between text-sm bg-navy-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium truncate flex-1 min-w-0">{player.name}</span>
                      <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded text-center w-8 flex-shrink-0 ${
                        player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                      }`}>{player.gender}</span>
                      <span className="text-[10px] text-navy-300 font-mono w-8 text-center flex-shrink-0">G{player.grade}</span>
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
          </div>

          {/* Point log */}
          <div>
            <label className="text-xs uppercase text-navy-300 font-semibold mb-2 block">
              Point Log
            </label>
            <div className="flex flex-wrap gap-1.5">
              {points.map((pt, i) => (
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
        </div>

        {/* Save button */}
        <div className="px-4 pt-2">
          <button
            onClick={saveGame}
            disabled={saving}
            className="btn-gold w-full text-lg py-5"
          >
            {saving ? 'Saving...' : 'Save Game'}
          </button>
        </div>
      </div>
    );
  }
}

// Point scoring UI component
function PointScoreSection({ onScored, lineupPlayerIds, players }) {
  const [showStats, setShowStats] = useState(false);
  const [pointStats, setPointStats] = useState([]);

  function handleScored(scoredBy) {
    onScored(scoredBy, pointStats);
    setPointStats([]);
    setShowStats(false);
  }

  return (
    <div>
      <div className="text-xs uppercase text-navy-300 font-semibold mb-2">Who Scored?</div>

      {!showStats ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowStats(true)}
            className="bg-score-green/20 border border-score-green/40 text-score-green py-4 rounded-xl font-semibold active:bg-score-green/30"
            style={{ minHeight: '44px' }}
          >
            We Scored
          </button>
          <button
            onClick={() => {
              handleScored('them');
            }}
            className="bg-score-red/20 border border-score-red/40 text-score-red py-4 rounded-xl font-semibold active:bg-score-red/30"
            style={{ minHeight: '44px' }}
          >
            They Scored
          </button>
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <div className="text-sm text-navy-300">Add stats for this point (optional)</div>

          <StatAttribution
            pointIndex={0}
            stats={pointStats}
            lineupPlayerIds={lineupPlayerIds}
            players={players}
            onAddStat={(_, playerId, statType) => {
              setPointStats([...pointStats, { playerId, type: statType }]);
            }}
            onRemoveStat={(_, playerId, statType) => {
              setPointStats(pointStats.filter(s => !(s.playerId === playerId && s.type === statType)));
            }}
            editable={true}
          />

          <div className="flex gap-2">
            <button
              onClick={() => handleScored('us')}
              className="flex-1 bg-score-green text-white py-3 rounded-lg font-semibold active:bg-score-green/80"
              style={{ minHeight: '44px' }}
            >
              Score
            </button>
            <button
              onClick={() => setShowStats(false)}
              className="flex-1 bg-navy-700 text-white py-3 rounded-lg font-semibold active:bg-navy-600"
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickEntryPointRow({ point, index, isExpanded, onToggleExpand, checkedInPlayerIds, players, onTogglePlayer, onSelectAll, onClear, onAddStat, onRemoveStat }) {
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-navy-700/50"
        style={{ minHeight: '48px' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-navy-300 w-7">#{index + 1}</span>
          <span className={`text-sm font-semibold ${point.scoredBy === 'us' ? 'text-score-green' : 'text-score-red'}`}>
            {point.scoredBy === 'us' ? 'Us' : 'Them'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-400">
            {point.lineup.length > 0 ? `${point.lineup.length} players` : 'No lineup'}
            {point.stats?.length > 0 ? ` · ${point.stats.length} stats` : ''}
          </span>
          <span className="text-navy-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-navy-700 pt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-navy-300 font-semibold uppercase">Lineup</span>
              <div className="flex gap-3 text-xs">
                <button onClick={onSelectAll} className="text-navy-300 underline active:text-white">All</button>
                <button onClick={onClear} className="text-navy-300 underline active:text-white">None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...checkedInPlayerIds].map(id => {
                const player = players.find(p => p.id === id);
                if (!player) return null;
                const isSelected = point.lineup.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => onTogglePlayer(index, id)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'bg-gold text-navy-950'
                        : 'bg-navy-800 text-navy-300 border border-navy-700'
                    }`}
                    style={{ minHeight: '36px' }}
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>
          </div>

          <StatAttribution
            pointIndex={index}
            stats={point.stats || []}
            lineupPlayerIds={point.lineup.length > 0 ? point.lineup : [...checkedInPlayerIds]}
            players={players}
            onAddStat={onAddStat}
            onRemoveStat={onRemoveStat}
            editable={true}
          />
        </div>
      )}
    </div>
  );
}
