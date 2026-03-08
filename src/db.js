import Dexie from 'dexie';

export const db = new Dexie('UltimateTracker');

db.version(1).stores({
  players: '++id, name, gender, grade',
  games: '++id, date, status',
  activeGame: 'id',
});

db.version(2).stores({
  players: '++id, name, gender, grade',
  games: '++id, date, status',
  activeGame: 'id',
  settings: 'key',
});

export default db;
