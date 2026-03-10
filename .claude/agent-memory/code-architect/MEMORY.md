# Code Architect - Agent Memory

## Codebase Architecture (verified 2026-03-09)

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
- Services: playerService.js (CRUD), settingsService.js (get/set)
- Utils: lineup.js (suggestLineup, previewLineups, getPlayerStats), sheets.js, sheetsSync.js
- Components: Scoreboard (sticky), PlayerCard (reusable), SubModal, AlertBanner
- Screens: Home, Roster, GameSetup, GameView, PastGames, Login

### Styling Conventions
- Navy theme: navy-950 (darkest bg) through navy-300 (light text)
- Gold accents: gold (primary CTA), gold-light, gold-dark
- Score colors: score-green (#22c55e), score-red (#ef4444)
- Gender: purple-600 for gx, navy-600 for bx
- Fonts: Bebas Neue (display), Outfit (body)
- All touch targets min 44px height
- CSS classes: .btn, .btn-primary, .btn-gold, .btn-score-us, .btn-score-them, .card

### Game State Shape (reducer initialState)
- active, id, opponent, date, startTime, field
- checkedInPlayerIds[], ourScore, theirScore
- gameStartedAt, pointStartedAt, halftimeTaken
- phase: 'pre-point' | 'playing' | 'halftime' | 'finished'
- currentPointNumber, onField[], ratioPattern[], ratioIndex, ratioOverride
- equalizeBy: 'points' | 'time'
- points[] (each: {number, lineup[], scoredBy, scorer, stats[], startedAt, endedAt})
- currentStats[], subDismissedAt

### Point Record Shape
```js
{ number, lineup: [playerId], scoredBy: 'us'|'them', scorer: playerId|null,
  stats: [{playerId, type}], startedAt: timestamp, endedAt: timestamp }
```

### File Locations
- Entry: src/main.jsx -> App.jsx
- Context: src/context/GameContext.jsx, src/contexts/AuthContext.jsx (note different dirs)
- Base path: /ultimate-tracker/

### Deployment (current)
- GitHub Pages via .github/workflows/deploy.yml
- vite.config.js: base: '/ultimate-tracker/'
- main.jsx: BrowserRouter basename="/ultimate-tracker"
- Firebase project: marmots-tracker

### Stat Types
- pointStats.js defines: D, assist, goal
- StatAttribution component handles per-point stat recording with player select -> stat type flow
- Stat chip styles: goal=green, assist=yellow, D=blue
