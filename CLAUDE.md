# Ultimate Tracker — Codebase Guide

> Ultimate frisbee coaching PWA for **Wedgwood Marmots**. Single coach, single team (~20 players).
> Built with React + Vite + Tailwind, Firebase (Firestore) for persistence, Dexie.js (IndexedDB) as local cache.

---

## Quick Orientation

```
src/
  App.jsx              # Router: 8 routes
  main.jsx             # Entry: AuthProvider + GameProvider + Router
  firebase.js          # Firestore init (offline persistence enabled)
  db.js                # Dexie.js schema (v1/v2: players, games, activeGame, settings)
  index.css            # Tailwind + global styles

  context/
    GameContext.jsx    # ALL game state — reducer with 37+ actions, Firestore sync

  contexts/
    AuthContext.jsx    # Firebase auth state

  hooks/
    usePlayers.js      # Firestore real-time listener for players
    useGames.js        # Firestore real-time listener for past games
    useCertifications.js
    useSpectatorGame.js
    useSpectatorStats.js

  screens/             # One file per route
    Home.jsx
    GameSetup.jsx
    GameView2.jsx      # Live game — the most complex screen
    Roster.jsx
    PastGames.jsx
    ManualGameEntry.jsx
    SkillDevelopment.jsx
    PlayerSkillDetail.jsx
    SpectatorView.jsx
    Login.jsx

  components/          # Reusable UI
    Scoreboard.jsx
    PointStrip.jsx
    PointDetailView.jsx   # Lineup picker — second most complex file
    GameActionBar.jsx
    SubModal.jsx
    LineupPlayerRow.jsx
    PlayerCard.jsx
    AlertBanner.jsx
    StatAttribution.jsx
    PlayerStatModal.jsx
    PlayerInfoModal.jsx
    CertBadge.jsx
    GameSummaryModal.jsx
    SpectatorPlayerCard.jsx
    SpectatorStatBar.jsx

  services/
    playerService.js   # Firestore CRUD for players
    gameService.js     # softDeleteGame
    settingsService.js # KV settings (sheet URLs, script URL)
    certificationService.js

  utils/
    lineup.js          # Lineup algorithm + player stat calculations
    sheets.js          # Google Sheets CSV fetch + parse
    sheetsSync.js      # Post-game sync to Google Apps Script webhook

  data/
    skillLevels.js     # 4-level cert structure (only L1-L2 active)
```

---

## Key Data Models

### Player (Firestore `players` collection)
```js
{
  id: string,          // Firestore auto ID
  name: string,
  gender: 'bx' | 'gx',
  grade: 3 | 4 | 5
}
```

### Game State (GameContext — the single source of truth during a live game)
```js
{
  active: boolean,
  id: number,                    // Date.now() at game start
  opponent: string,
  date: string,                  // 'YYYY-MM-DD'
  startTime: string,             // 'HH:MM'
  field: string,
  checkedInPlayerIds: string[],
  unavailablePlayerIds: string[],
  ourScore: number,
  theirScore: number,
  gameStartedAt: number,         // timestamp
  pointStartedAt: number | null, // null when clock paused (halftime, timeout)
  halftimeTaken: boolean,
  phase: 'pre-point' | 'playing' | 'timeout-sub' | 'halftime' | 'finished',
  currentPointNumber: number,
  onField: string[],             // 5 player IDs currently on field
  ratioPattern: { bx, gx }[],   // e.g., [{ bx:3, gx:2 }, { bx:2, gx:3 }]
  ratioIndex: number,
  ratioOverride: null | { bx, gx },
  equalizeBy: 'points' | 'time',
  points: Point[],               // completed points
  currentStats: Stat[],          // stats for point in progress
  viewingPointIndex: null | number,
  midPointSubs: { outId, inId, timestamp }[],
  timeoutSubs: { lineup, startedAt, endedAt }[], // segments for current point
  subDismissedAt: number | null
}
```

### Point (element of `state.points[]`)
```js
{
  number: number,
  lineup: string[],              // player IDs on field when point scored
  scoredBy: 'us' | 'them',
  stats: Stat[],
  midPointSubs: { outId, inId, timestamp }[],
  timeoutSubs: { lineup, startedAt, endedAt }[], // set if timeout happened mid-point
  startedAt: number,
  endedAt: number
}
```
> When `timeoutSubs` is non-empty, `startedAt` is the first segment's start (total wall-clock time).
> Stats are attributed per-segment in `getDetailedPlayerStats`.

### Stat
```js
{ playerId: string, type: 'goal' | 'assist' | 'd' | 'D' | 'greatThrow' | 'score' }
```

---

## State Management

**Everything flows through `GameContext`** — no local state for game logic.

### All ACTIONS
| Action | When |
|--------|------|
| `RESTORE` | Load active game from Firestore on mount |
| `START_GAME` | GameSetup → GameView2 |
| `SET_LINEUP` | Pre-point lineup selection |
| `START_POINT` | Coach taps "Start Point" |
| `SCORE` | Point scored (us or them) |
| `UNDO_SCORE` | Revert last point |
| `ADD_STAT` / `REMOVE_STAT` | Stats during current point |
| `ADD_POINT_STAT` / `REMOVE_POINT_STAT` | Stats on past/current point |
| `MID_POINT_SUB` | Swap player during `playing` phase |
| `SET_VIEWING_POINT` | Select point in PointStrip |
| `SWAP_PLAYER` | Replace player in pre-point lineup |
| `OVERRIDE_RATIO` | Coach ratio override |
| `SET_EQUALIZE` | Toggle 'points' vs 'time' mode |
| `START_HALFTIME` / `END_HALFTIME` | Phase transitions |
| `DISMISS_SUB` | Dismiss 10-min sub suggestion |
| `CHECK_IN_PLAYER` / `CHECK_OUT_PLAYER` | Roster during game |
| `MARK_UNAVAILABLE` / `MARK_AVAILABLE` | Player availability |
| `EDIT_POINT_SCORED_BY` | Change us/them on past point |
| `EDIT_POINT_LINEUP` | Edit past point's lineup |
| `TIMEOUT_START` | Pause clock, enter `timeout-sub` phase |
| `RESUME_POINT` | Resume from timeout, fresh `pointStartedAt` |
| `END_GAME` / `CLEAR_GAME` | End/reset game |

### Persistence
- **On mount**: Restore from Firestore `activeGame/current`
- **On every state change**: Debounced 500ms write to Firestore
- **Game end**: Write to `games/{id}` + delete `activeGame/current`
- Firebase is configured with offline persistence — queued writes sync on reconnect

> `SET_LINEUP` is blocked during `playing` phase. Use `MID_POINT_SUB` for in-point swaps.

---

## Screens

| Screen | Route | Purpose |
|--------|-------|---------|
| `Home` | `/` | Dashboard: upcoming games from sheet, active game banner |
| `GameSetup` | `/setup` | Opponent, date, field, roster import, ratio preset, check-in |
| `GameView2` | `/play` | **Live game** — all game actions happen here |
| `Roster` | `/roster` | Add/edit/delete players, bulk sheet import |
| `PastGames` | `/games` | Game history, expandable, CSV export, soft delete |
| `ManualGameEntry` | `/manual` | Bulk CSV import of historical games |
| `SkillDevelopment` | `/skills` | Cert tracker: sort by name/tier |
| `PlayerSkillDetail` | `/skills/:id` | Individual player cert journey |
| `SpectatorView` | `/watch/:gameId` | Public real-time scoreboard (no auth) |
| `Login` | `/login` | Email/password Firebase auth |

---

## Components — PointDetailView & LineupPlayerRow

These two are tightly coupled and the most frequently edited.

### `PointDetailView.jsx`
The main lineup editing UI. Shows:
- On-field players (5) with stats
- Bench players sorted by who needs rest most
- Ratio badge + equalizer toggle (Points/Time)
- Past point view (read-only, or edit mode via `EDIT_POINT_LINEUP`)

Key props it receives from GameView2: `state`, `dispatch`, `players`, `isCurrentPoint`, `phase`

### `LineupPlayerRow.jsx`
Single player row used for both on-field and bench. Key props:
- `onNameTap` — makes name tappable (used on-field, opens PlayerInfoModal)
- `onInfoTap` — (i) button (used on bench)
- `onStatTap` — opens PlayerStatModal
- `hideStatBadges` — hides D/A/G count chips (used on-field current point)
- `equalizeBy` — controls info line display (points vs time)
- `pointsSinceLastPlay` — shown in points mode
- `isLeastPlayed` — shows teal left border (`border-l-2 border-teal-500/60`)
- `isWarning` — yellow left border (long bench time)

---

## Lineup Algorithm (`utils/lineup.js`)

**Goal**: Equalize playing time, rest players, maintain gender ratio, diversify grades.

```
suggestLineup(players, checkedInIds, ratio, points, equalizeBy)
  1. getDetailedPlayerStats() for each player
  2. Sort each gender: fewest points/time → longest bench time
  3. Take top N of each gender per ratio
  4. If gender short, fill from the other gender
  5. Grade diversity: if all same grade + >3 on field, swap last for different grade
```

**`getDetailedPlayerStats(playerId, points, now)`** returns:
- `pointsPlayed` — total points in lineup
- `totalPlayingTimeMs` — wall-clock time on field
- `lastPointEndedAt` — for bench time calc
- `benchTimeMs` — time since last played
- `pointsSinceLastPlay` — points back to last played

When a point has `timeoutSubs`, each segment is counted separately for time attribution.

---

## Timeout Flow

1. Coach taps **Timeout** during `playing` phase
2. `TIMEOUT_START` fires:
   - Saves current segment `{ lineup, startedAt, endedAt }` into `state.timeoutSubs`
   - Sets `phase = 'timeout-sub'`, `pointStartedAt = null`
3. Coach adjusts lineup (on-field swaps work normally)
4. Coach taps **Resume Point**:
   - `RESUME_POINT` fires: `phase = 'playing'`, fresh `pointStartedAt`
5. When point is scored (`SCORE`):
   - Final segment appended to `timeoutSubs`
   - All segments stored in `point.timeoutSubs`
   - `state.timeoutSubs` cleared

**UI during `timeout-sub`:**
- Scoreboard: pulsing "TIMEOUT" label
- Banner above PointDetailView: "TIMEOUT — adjust lineup for resume"
- ActionBar: "Auto-pick" + "Resume Point" buttons

---

## Gender Ratio

`ratioPattern` is an array of `{ bx, gx }` objects that repeat cyclically.

Presets (set in GameSetup):
- `3bx/2gx` only, `2bx/3gx` only
- Alternating `3/2 & 2/3` (most common)
- `4bx/1gx`, `1bx/4gx`, `5bx/0gx`, `0bx/5gx`

Coach can override a single point with `OVERRIDE_RATIO`.

---

## Game Rules (hard-coded alerts)

- **Win**: First to 11
- **Halftime**: 6 pts or 30-min wall-clock cap (whichever first)
- **Hard cap**: 60 min — finish current point, one more possession each
- **70 min**: tie possible

Time thresholds for UI warnings:
- 25 min: orange game clock
- 55 min: red game clock
- 60 min: red danger banner

---

## Google Sheets Integration

### Reading Data
`fetchSheetCSV(sheetId, sheetName)` tries two methods:
1. `gviz/tq` API (works for "anyone with link can view")
2. `/pub` CSV fallback (requires "published to web")

**Roster sheet** expected columns: Name, Gender (bx/gx), Grade (3/4/5)
**Schedule sheet** expected columns: Date, Opponent, Start Time, Field

### Writing Results
`syncGameToSheet(state, players)` — POST to a Google Apps Script webhook URL.
URL configured per-device in Settings. Default URL is hardcoded as fallback.

---

## Firebase / Firestore

**Project ID**: `marmots-tracker`

**Collections:**
| Collection | Purpose |
|------------|---------|
| `players` | All players (real-time via `usePlayers`) |
| `games` | Completed games (real-time via `useGames`) |
| `activeGame/current` | Active game state (single doc) |
| `settings` | KV: rosterSheetUrl, scheduleSheetUrl, scriptUrl |

**Auth**: Email/password (single coach account)

---

## Styling Conventions

**Tailwind classes:**
- `btn` — base button
- `btn-primary` — navy fill button
- `btn-gold` — gold fill button (key actions)
- `card` — white card with shadow

**Colors:**
- Navy: `navy-950` (#080f1a) → `navy-300` (#8badd4)
- Gold: `#f5a623` (with `text-gold`, `bg-gold`, `border-gold`)
- Fonts: `Bebas Neue` (display/numbers), `Outfit` (body)

**Mobile-first:** All tap targets `minHeight: 44px`. Safe area inset applied at bottom.

---

## Common Gotchas

- **`SET_LINEUP` is blocked during `playing` phase** — use `MID_POINT_SUB` for in-point swaps
- **`timeoutSubs` may be undefined** in old saved state — always use `state.timeoutSubs || []`
- **Points are 0-indexed in the array, 1-indexed in the UI** — `point.number` is the display number
- **`bx` / `gx` are gender identifiers** — not descriptive gender labels
- **Stat types:** both `'score'` and `'goal'` exist (legacy dual usage) — treat as the same thing
- **`equalizeBy` defaults to `'points'`** — time mode is less commonly used
- **Firestore offline persistence** means reads always succeed (cached) — write failures are silent and retried
