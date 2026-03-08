/**
 * Google Sheets integration utilities.
 * Works with publicly published Google Sheets (no OAuth needed).
 */

/**
 * Extract the sheet ID from a Google Sheets URL.
 * Handles formats like:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/pubhtml
 *   https://docs.google.com/spreadsheets/d/SHEET_ID
 */
export function extractSheetId(url) {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch a published Google Sheet tab as CSV text.
 * @param {string} sheetId - The Google Sheets document ID
 * @param {string} sheetName - The tab/sheet name (default: first sheet)
 * @returns {Promise<string>} CSV text
 */
export async function fetchSheetCSV(sheetId, sheetName = '') {
  const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&single=true${sheetParam}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}. Make sure the sheet is published to the web.`);
  }
  return response.text();
}

/**
 * Parse CSV text into an array of rows (arrays of strings).
 * Handles quoted fields with commas and newlines.
 */
export function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current.trim());
        if (row.some(cell => cell !== '')) {
          rows.push(row);
        }
        row = [];
        current = '';
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  // Last field
  row.push(current.trim());
  if (row.some(cell => cell !== '')) {
    rows.push(row);
  }
  return rows;
}

/**
 * Parse roster data from CSV rows.
 * Expected columns: Name, Gender (bx/gx), Grade (3/4/5)
 * Skips header row if detected.
 * @returns {{ name: string, gender: string, grade: number }[]}
 */
export function parseRosterFromCSV(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  // Detect header row
  let startIdx = 0;
  const firstRow = rows[0].map(c => c.toLowerCase());
  if (firstRow.some(c => c.includes('name')) || firstRow.some(c => c.includes('gender'))) {
    startIdx = 1;
  }

  const players = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const name = row[0].trim();
    const gender = row[1].trim().toLowerCase();
    const gradeStr = row[2].trim();

    if (!name) continue;
    if (gender !== 'bx' && gender !== 'gx') continue;
    if (!['3', '4', '5'].includes(gradeStr)) continue;

    players.push({ name, gender, grade: parseInt(gradeStr) });
  }
  return players;
}

/**
 * Parse game schedule from CSV rows.
 * Expected columns: Date, Opponent, Start Time, Field
 * @returns {{ date: string, opponent: string, startTime: string, field: string }[]}
 */
export function parseScheduleFromCSV(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  // Detect header row
  let startIdx = 0;
  const firstRow = rows[0].map(c => c.toLowerCase());
  if (firstRow.some(c => c.includes('date')) || firstRow.some(c => c.includes('opponent'))) {
    startIdx = 1;
  }

  const games = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const date = row[0]?.trim() || '';
    const opponent = row[1]?.trim() || '';
    const startTime = row[2]?.trim() || '';
    const field = row[3]?.trim() || '';

    if (!opponent) continue;
    games.push({ date, opponent, startTime, field });
  }
  return games;
}
