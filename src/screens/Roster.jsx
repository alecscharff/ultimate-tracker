import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { extractSheetId, fetchSheetCSV, parseRosterFromCSV } from '../utils/sheets';

export default function Roster() {
  const navigate = useNavigate();
  const players = useLiveQuery(() => db.players.orderBy('name').toArray()) || [];

  const [name, setName] = useState('');
  const [gender, setGender] = useState('bx');
  const [grade, setGrade] = useState('4');
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Google Sheets import
  const [showSheetImport, setShowSheetImport] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTab, setSheetTab] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetPreview, setSheetPreview] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Results sync script
  const [showScriptSetup, setShowScriptSetup] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');
  const [scriptSaved, setScriptSaved] = useState(false);

  // Load saved URLs
  useEffect(() => {
    db.settings.get('rosterSheetUrl').then(setting => {
      if (setting?.value) setSheetUrl(setting.value);
    }).catch(() => {});
    db.settings.get('rosterSheetTab').then(setting => {
      if (setting?.value) setSheetTab(setting.value);
    }).catch(() => {});
    db.settings.get('scriptUrl').then(setting => {
      if (setting?.value) setScriptUrl(setting.value);
    }).catch(() => {});
  }, []);

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

  async function handleSheetFetch() {
    setSheetError('');
    setSheetPreview(null);

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      setSheetError('Invalid Google Sheets URL. Paste the full URL from your browser.');
      return;
    }

    setSheetLoading(true);
    try {
      // Save the URL for next time
      await db.settings.put({ key: 'rosterSheetUrl', value: sheetUrl });
      if (sheetTab) {
        await db.settings.put({ key: 'rosterSheetTab', value: sheetTab });
      }

      const csv = await fetchSheetCSV(sheetId, sheetTab);
      const parsed = parseRosterFromCSV(csv);

      if (parsed.length === 0) {
        setSheetError('No valid players found. Expected columns: Name, Gender (bx/gx), Grade (3/4/5)');
      } else {
        setSheetPreview(parsed);
      }
    } catch (err) {
      setSheetError(err.message || 'Failed to fetch sheet. Share it as "Anyone with the link can view" or publish it to the web.');
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleSheetImportConfirm() {
    if (!sheetPreview) return;

    // Avoid duplicates by name
    const existingNames = new Set(players.map(p => p.name.toLowerCase()));
    const newPlayers = sheetPreview.filter(p => !existingNames.has(p.name.toLowerCase()));

    if (newPlayers.length > 0) {
      await db.players.bulkAdd(newPlayers);
    }

    const skipped = sheetPreview.length - newPlayers.length;
    setSheetPreview(null);
    setSheetError(
      newPlayers.length > 0
        ? `Imported ${newPlayers.length} player${newPlayers.length !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}.`
        : `All ${skipped} player${skipped !== 1 ? 's' : ''} already on roster.`
    );
  }

  return (
    <div className="min-h-dvh pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-navy-300 active:text-white text-2xl leading-none px-1 py-2" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&larr;</button>
        <h1 className="font-display text-2xl">ROSTER</h1>
        <span className="text-navy-300 text-sm ml-auto">{players.length} players</span>
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

      {/* Import options */}
      <div className="px-4 pt-3 space-y-2">
        {/* Google Sheets Import */}
        <button
          onClick={() => { setShowSheetImport(!showSheetImport); setShowImport(false); }}
          className="text-sm text-gold font-semibold underline underline-offset-2 active:text-gold-light py-2"
          style={{ minHeight: '44px' }}
        >
          {showSheetImport ? 'Hide Google Sheets import' : 'Import from Google Sheets'}
        </button>

        {showSheetImport && (
          <div className="card p-4 space-y-3">
            <p className="text-xs text-navy-300 leading-relaxed">
              Paste your Google Sheets URL below. The sheet must be shared as "Anyone with the link can view"
              (Share button &gt; Change to anyone with the link). Expected columns: Name, Gender (bx/gx), Grade (3/4/5).
            </p>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              className="w-full text-sm"
            />
            <input
              type="text"
              placeholder="Sheet tab name (optional, e.g. 'Roster')"
              value={sheetTab}
              onChange={e => setSheetTab(e.target.value)}
              className="w-full text-sm"
            />
            <button
              onClick={handleSheetFetch}
              disabled={!sheetUrl.trim() || sheetLoading}
              className="btn-gold w-full"
            >
              {sheetLoading ? 'Fetching...' : 'Fetch Roster'}
            </button>

            {sheetUrl.trim() && (
              <button
                onClick={() => {
                  const link = `${window.location.origin}/ultimate-tracker/?sheet=${encodeURIComponent(sheetUrl.trim())}`;
                  navigator.clipboard.writeText(link).then(() => {
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  });
                }}
                className="btn-primary w-full text-sm"
              >
                {shareCopied ? 'Link Copied!' : 'Copy Share Link for Another Coach'}
              </button>
            )}

            {sheetError && (
              <p className={`text-xs ${sheetError.startsWith('Imported') || sheetError.startsWith('All') ? 'text-score-green' : 'text-score-red'}`}>
                {sheetError}
              </p>
            )}

            {sheetPreview && (
              <div className="space-y-2">
                <div className="text-xs text-navy-300 font-semibold">
                  Found {sheetPreview.length} player{sheetPreview.length !== 1 ? 's' : ''}:
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {sheetPreview.map((p, i) => {
                    const isDuplicate = players.some(
                      existing => existing.name.toLowerCase() === p.name.toLowerCase()
                    );
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                          isDuplicate ? 'opacity-40' : ''
                        }`}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${
                          p.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                        }`}>{p.gender}</span>
                        <span className="text-[10px] text-navy-300 font-mono">G{p.grade}</span>
                        {isDuplicate && <span className="text-[10px] text-navy-400">(already on roster)</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSheetImportConfirm} className="btn-gold flex-1">
                    Import Players
                  </button>
                  <button onClick={() => setSheetPreview(null)} className="btn-primary flex-1">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual paste import */}
        <button
          onClick={() => { setShowImport(!showImport); setShowSheetImport(false); }}
          className="text-sm text-navy-300 underline underline-offset-2 active:text-white py-2"
          style={{ minHeight: '44px' }}
        >
          {showImport ? 'Hide manual import' : 'Paste from spreadsheet'}
        </button>
        {showImport && (
          <div className="mt-2">
            <p className="text-xs text-navy-400 mb-2">
              Paste rows from your spreadsheet. Format: Name, Gender (bx/gx), Grade (3/4/5) -- one player per line, comma or tab separated.
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

        {/* Results sync script */}
        <button
          onClick={() => { setShowScriptSetup(!showScriptSetup); setShowImport(false); setShowSheetImport(false); }}
          className="text-sm text-navy-300 underline underline-offset-2 active:text-white py-2"
          style={{ minHeight: '44px' }}
        >
          {showScriptSetup ? 'Hide results sync setup' : 'Set up results sync to Sheets'}
        </button>
        {showScriptSetup && (
          <div className="card p-4 space-y-3">
            <p className="text-xs text-navy-300 leading-relaxed">
              Paste the Google Apps Script web app URL to automatically sync game results and player stats to your sheet after each game.
              See <span className="font-mono text-gold">sheets-sync-script.js</span> in the project for setup instructions.
            </p>
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/..."
              value={scriptUrl}
              onChange={e => setScriptUrl(e.target.value)}
              className="w-full text-sm"
            />
            <button
              onClick={async () => {
                if (!scriptUrl.trim()) return;
                await db.settings.put({ key: 'scriptUrl', value: scriptUrl.trim() });
                setScriptSaved(true);
                setTimeout(() => setScriptSaved(false), 2000);
              }}
              disabled={!scriptUrl.trim()}
              className="btn-gold w-full"
            >
              {scriptSaved ? 'Saved!' : 'Save Script URL'}
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
            style={{ minHeight: '44px' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold truncate">{player.name}</span>
              <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded ${
                player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
              }`}>
                {player.gender}
              </span>
              <span className="text-[11px] text-navy-300 font-mono">G{player.grade}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => startEdit(player)}
                className="text-xs text-navy-300 active:text-white px-3 py-2 rounded-lg"
                style={{ minHeight: '36px' }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(player.id)}
                className="text-xs text-score-red/70 active:text-score-red px-3 py-2 rounded-lg"
                style={{ minHeight: '36px' }}
              >
                Del
              </button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <div className="text-center text-navy-400 py-12">
            No players yet. Add players above or import from Google Sheets.
          </div>
        )}
      </div>
    </div>
  );
}
