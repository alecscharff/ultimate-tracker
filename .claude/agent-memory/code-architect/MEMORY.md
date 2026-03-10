# Code Architect - Agent Memory

## Codebase Architecture (verified 2026-03-10)

### Stack
- React 18 + Vite 5 + Tailwind 3 + Firebase 12
- PWA via vite-plugin-pwa, offline via Firestore persistentLocalCache
- Router: react-router-dom v6
- Legacy Dexie.js (db.js) still present but only used in sheetsSync.js for settings fallback

### State Management
- GameContext: useReducer with 15 actions, debounced Firestore save (500ms) to `activeGame/current`
- No global state lib; local useState in screens
- Auth: AuthContext (contexts/AuthContext.jsx) wraps app in main.jsx

### Firestore Collections
- `players` - {name, gender, grade} ordered by name
- `games` - completed games keyed by timestamp ID, ordered by endedAt desc
- `activeGame/current` - single doc, full game state blob
- `settings` - key-value pairs {value: any}

### Key Patterns
- Hooks: usePlayers/useGames use onSnapshot for realtime sync
- Services: playerService.js (CRUD), settingsService.js (get/set), NO gameService yet
- Utils: lineup.js (suggestLineup, previewLineups, getPlayerStats, getDetailedPlayerStats), sheets.js, sheetsSync.js
- Components: Scoreboard (sticky), PlayerCard (reusable), SubModal, AlertBanner, LineupPlayerRow, PlayerStatModal
- Screens: Home, Roster, GameSetup, GameView2, PastGames, Login

### Styling Conventions
- Navy theme: navy-950 (darkest bg) through navy-300 (light text)
- Gold accents: gold (primary CTA), gold-light, gold-dark
- Score colors: score-green (#22c55e), score-red (#ef4444)
- Gender dot: purple-500 for gx, blue-500 for bx (in LineupPlayerRow); purple-600/navy-600 badges elsewhere
- Fonts: Bebas Neue (display), Outfit (body)
- All touch targets min 44px height
- CSS classes: .btn, .btn-primary, .btn-gold, .btn-score-us, .btn-score-them, .card

### Game State Shape (reducer initialState)
- active, id, opponent, date, startTime, field
- checkedInPlayerIds[], ourScore, theirScore, gameStartedAt, pointStartedAt, halftimeTaken
- phase: 'pre-point' | 'playing' | 'halftime' | 'finished'
- currentPointNumber, onField[], ratioPattern[], ratioIndex, ratioOverride
- equalizeBy: 'points' | 'time'
- points[], currentStats[], subDismissedAt, viewingPointIndex, midPointSubs[]

### Key Component Relationships
- GameView2 -> Scoreboard, AlertBanner, PointStrip, PointDetailView, GameActionBar, SubModal, GameSummaryModal
- PointDetailView -> LineupPlayerRow (per player), PlayerStatModal (stat editing)
- LineupPlayerRow: gender dot, name, grade, pointsPlayed, benchTime, totalTime, stat badges, move/checkin/stat buttons
- PlayerStatModal: bottom-sheet for adding/removing stats per player per point
- Stats data model already supports multiple of any stat type per point (array of {playerId, type})

### Stats Utils
- getDetailedPlayerStats (lineup.js): pointsPlayed, totalPlayingTimeMs, benchTimeMs, pointsSinceLastPlay
- getPlayerStats (lineup.js): pointsPlayed, minutesPlayed, scores, assists, ds, plusMinus
- getAggregatedPlayerStats (pointStats.js): goals, assists, ds, pointsPlayed

### Deployment
- GitHub Pages via .github/workflows/deploy.yml
- vite.config.js: base: '/ultimate-tracker/'
- Firebase project: marmots-tracker
