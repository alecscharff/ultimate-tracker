import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import db from '../db';

const GameContext = createContext(null);

const initialState = {
  active: false,
  id: null,
  opponent: '',
  date: '',
  startTime: '',
  field: '',
  checkedInPlayerIds: [],
  ourScore: 0,
  theirScore: 0,
  gameStartedAt: null,
  pointStartedAt: null,
  halftimeTaken: false,
  phase: 'pre-point', // pre-point | playing | halftime | finished
  currentPointNumber: 1,
  onField: [],
  ratioPattern: [{ bx: 3, gx: 2 }],
  ratioIndex: 0,
  ratioOverride: null,
  equalizeBy: 'points', // 'points' | 'time'
  points: [],
  currentStats: [],
  subDismissedAt: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'RESTORE':
      return { ...initialState, ...action.state };

    case 'START_GAME':
      return {
        ...initialState,
        active: true,
        id: Date.now(),
        opponent: action.opponent,
        date: action.date,
        startTime: action.startTime,
        field: action.field,
        checkedInPlayerIds: action.playerIds,
        ratioPattern: action.ratioPattern,
        gameStartedAt: Date.now(),
        phase: 'pre-point',
      };

    case 'SET_LINEUP':
      return { ...state, onField: action.lineup };

    case 'START_POINT':
      return { ...state, phase: 'playing', pointStartedAt: Date.now(), subDismissedAt: null };

    case 'SCORE': {
      const point = {
        number: state.currentPointNumber,
        lineup: [...state.onField],
        scoredBy: action.scoredBy,
        scorer: action.scorer || null,
        stats: [...state.currentStats],
        startedAt: state.pointStartedAt,
        endedAt: Date.now(),
      };
      const newOur = state.ourScore + (action.scoredBy === 'us' ? 1 : 0);
      const newTheir = state.theirScore + (action.scoredBy === 'them' ? 1 : 0);
      const gameOver = newOur >= 11 || newTheir >= 11;
      const nextRatioIndex = (state.ratioIndex + 1) % state.ratioPattern.length;

      return {
        ...state,
        ourScore: newOur,
        theirScore: newTheir,
        points: [...state.points, point],
        currentPointNumber: state.currentPointNumber + 1,
        phase: gameOver ? 'finished' : 'pre-point',
        pointStartedAt: null,
        currentStats: [],
        ratioIndex: nextRatioIndex,
        ratioOverride: null,
        onField: [],
        subDismissedAt: null,
      };
    }

    case 'UNDO_SCORE': {
      if (state.points.length === 0) return state;
      const lastPoint = state.points[state.points.length - 1];
      const wasUs = lastPoint.scoredBy === 'us';
      return {
        ...state,
        ourScore: state.ourScore - (wasUs ? 1 : 0),
        theirScore: state.theirScore - (wasUs ? 0 : 1),
        points: state.points.slice(0, -1),
        currentPointNumber: state.currentPointNumber - 1,
        phase: 'pre-point',
        pointStartedAt: null,
        currentStats: lastPoint.stats || [],
        ratioIndex: (state.ratioIndex - 1 + state.ratioPattern.length) % state.ratioPattern.length,
        ratioOverride: null,
        onField: lastPoint.lineup || [],
      };
    }

    case 'ADD_STAT':
      return {
        ...state,
        currentStats: [...state.currentStats, { playerId: action.playerId, type: action.statType }],
      };

    case 'REMOVE_STAT': {
      const idx = state.currentStats.findLastIndex(
        s => s.playerId === action.playerId && s.type === action.statType
      );
      if (idx === -1) return state;
      const next = [...state.currentStats];
      next.splice(idx, 1);
      return { ...state, currentStats: next };
    }

    case 'SWAP_PLAYER':
      return {
        ...state,
        onField: state.onField.map(id => (id === action.outId ? action.inId : id)),
      };

    case 'OVERRIDE_RATIO':
      return { ...state, ratioOverride: action.ratio };

    case 'SET_EQUALIZE':
      return { ...state, equalizeBy: action.equalizeBy };

    case 'START_HALFTIME':
      return { ...state, phase: 'halftime', halftimeTaken: true };

    case 'END_HALFTIME':
      return { ...state, phase: 'pre-point' };

    case 'DISMISS_SUB':
      return { ...state, subDismissedAt: Date.now() };

    case 'CHECK_IN_PLAYER':
      return {
        ...state,
        checkedInPlayerIds: state.checkedInPlayerIds.includes(action.playerId)
          ? state.checkedInPlayerIds
          : [...state.checkedInPlayerIds, action.playerId],
      };

    case 'CHECK_OUT_PLAYER':
      return {
        ...state,
        checkedInPlayerIds: state.checkedInPlayerIds.filter(id => id !== action.playerId),
        onField: state.onField.filter(id => id !== action.playerId),
      };

    case 'END_GAME':
      return { ...state, phase: 'finished' };

    case 'CLEAR_GAME':
      return { ...initialState };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, rawDispatch] = useReducer(gameReducer, initialState);

  // Restore active game on mount
  useEffect(() => {
    db.activeGame.get('current').then(saved => {
      if (saved?.state) {
        rawDispatch({ type: 'RESTORE', state: saved.state });
      }
    });
  }, []);

  // Persist on every state change
  const dispatch = useCallback(
    action => {
      rawDispatch(action);
    },
    []
  );

  useEffect(() => {
    if (state.active) {
      db.activeGame.put({ id: 'current', state });
    }
  }, [state]);

  const saveAndEndGame = useCallback(async () => {
    const gameRecord = {
      id: state.id,
      opponent: state.opponent,
      date: state.date,
      startTime: state.startTime,
      field: state.field,
      ourScore: state.ourScore,
      theirScore: state.theirScore,
      points: state.points,
      checkedInPlayerIds: state.checkedInPlayerIds,
      ratioPattern: state.ratioPattern,
      gameStartedAt: state.gameStartedAt,
      endedAt: Date.now(),
      status: 'completed',
    };
    await db.games.put(gameRecord);
    await db.activeGame.delete('current');
    rawDispatch({ type: 'CLEAR_GAME' });
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch, saveAndEndGame }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
