import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';

export default function Roster() {
  const navigate = useNavigate();
  const players = useLiveQuery(() => db.players.orderBy('name').toArray()) || [];

  const [name, setName] = useState('');
  const [gender, setGender] = useState('bx');
  const [grade, setGrade] = useState('4');
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await db.players.update(editingId, { name: name.trim(), gender, grade: parseInt(grade) });
      setEditingId(null);
    } else {
      await db.players.add({ name: name.trim(), gender, grade: parseInt(grade) });
    }
    setName('');
    setGender('bx');
    setGrade('4');
  }

  function startEdit(player) {
    setEditingId(player.id);
    setName(player.name);
    setGender(player.gender);
    setGrade(String(player.grade));
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setGender('bx');
    setGrade('4');
  }

  async function handleDelete(id) {
    await db.players.delete(id);
    if (editingId === id) cancelEdit();
  }

  async function handleImport() {
    const lines = importText.trim().split('\n').filter(Boolean);
    const newPlayers = [];
    for (const line of lines) {
      const parts = line.split(/[\t,]/).map(s => s.trim());
      if (parts.length >= 3) {
        const [pName, pGender, pGrade] = parts;
        const g = pGender.toLowerCase();
        if ((g === 'bx' || g === 'gx') && ['3', '4', '5'].includes(pGrade)) {
          newPlayers.push({ name: pName, gender: g, grade: parseInt(pGrade) });
        }
      }
    }
    if (newPlayers.length > 0) {
      await db.players.bulkAdd(newPlayers);
      setImportText('');
      setShowImport(false);
    }
  }

  return (
    <div className="min-h-dvh pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-navy-400 active:text-white text-2xl leading-none">&larr;</button>
        <h1 className="font-display text-2xl">ROSTER</h1>
        <span className="text-navy-400 text-sm ml-auto">{players.length} players</span>
      </div>

      {/* Add/Edit form */}
      <form onSubmit={handleSubmit} className="px-4 py-4 border-b border-navy-800">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-0"
          />
          <select value={gender} onChange={e => setGender(e.target.value)} className="w-16">
            <option value="bx">bx</option>
            <option value="gx">gx</option>
          </select>
          <select value={grade} onChange={e => setGrade(e.target.value)} className="w-16">
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn-gold flex-1 py-3">
            {editingId ? 'Update' : 'Add Player'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn-primary px-4 py-3">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Import */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowImport(!showImport)}
          className="text-sm text-navy-400 underline underline-offset-2 active:text-white"
        >
          {showImport ? 'Hide import' : 'Import from spreadsheet'}
        </button>
        {showImport && (
          <div className="mt-2">
            <p className="text-xs text-navy-500 mb-2">
              Paste rows from your spreadsheet. Format: Name, Gender (bx/gx), Grade (3/4/5) — one player per line, comma or tab separated.
            </p>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"Alex, bx, 5\nJordan, gx, 4\nSam, bx, 3"}
              rows={4}
              className="w-full text-sm"
            />
            <button onClick={handleImport} className="btn-primary w-full mt-2 py-3">
              Import Players
            </button>
          </div>
        )}
      </div>

      {/* Player list */}
      <div className="px-4 mt-4 space-y-2">
        {players.map(player => (
          <div
            key={player.id}
            className="card px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold truncate">{player.name}</span>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
              }`}>
                {player.gender}
              </span>
              <span className="text-[10px] text-navy-400 font-mono">G{player.grade}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(player)}
                className="text-xs text-navy-400 active:text-white px-2 py-1"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(player.id)}
                className="text-xs text-score-red/70 active:text-score-red px-2 py-1"
              >
                Del
              </button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <div className="text-center text-navy-500 py-12">
            No players yet. Add players above or import from a spreadsheet.
          </div>
        )}
      </div>
    </div>
  );
}
