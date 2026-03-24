import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const GameContext = createContext(null);

// Action type constants — import these in consuming components
export const ACTIONS = {
  RESTORE: 'RESTORE',
  START_GAME: 'START_GAME',
  SET_LINEUP: 'SET_LINEUP',
  START_POINT: 'START_POINT',
  SCORE: 'SCORE',
  UNDO_SCORE: 'UNDO_SCORE',
  ADD_STAT: 'ADD_STAT',
  REMOVE_STAT: 'REMOVE_STAT',
  ADD_POINT_STAT: 'ADD_POINT_STAT',
  REMOVE_POINT_STAT: 'REMOVE_POINT_STAT',
  MID_POINT_SUB: 'MID_POINT_SUB',
  SET_VIEWING_POINT: 'SET_VIEWING_POINT',
  SWAP_PLAYER: 'SWAP_PLAYER',
  OVERRIDE_RATIO: 'OVERRIDE_RATIO',
  SET_EQUALIZE: 'SET_EQUALIZE',
  START_HALFTIME: 'START_HALFTIME',
  END_HALFTIME: 'END_HALFTIME',
  DISMISS_SUB: 'DISMISS_SUB',
  CHECK_IN_PLAYER: 'CHECK_IN_PLAYER',
  CHECK_OUT_PLAYER: 'CHECK_OUT_PLAYER',
  END_GAME: 'END_GAME',
  CLEAR_GAME: 'CLEAR_GAME',
  MARK_UNAVAILABLE: 'MARK_UNAVAILABLE',
  MARK_AVAILABLE: 'MARK_AVAILABLE',
  EDIT_POINT_SCORED_BY: 'EDIT_POINT_SCORED_BY',
  TIMEOUT_START: 'TIMEOUT_START',
  RESUME_POINT: 'RESUME_POINT',
  EDIT_POINT_LINEUP: 'EDIT_POINT_LINEUP',
};

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
  viewingPointIndex: null,  // null = current point, number = viewing past point
  midPointSubs: [],         // [{ outId, inId, timestamp }] for current point
  unavailablePlayerIds: [],
  timeoutSubs: [],          // [{ lineup, startedAt, endedAt }] segments completed during timeout subs this point
  flipWinner: null,
  flipChoice: null,
  startingDirection: null,
  genderFlipWinner: null,
  halftimeAfterPointCount: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'RESTORE':
      return { ...initialState, ...action.state };

    case 'START_GAME':
      return {
        ...initialState,
        active: true,
        id: action.id ?? Date.now(),
        opponent: action.opponent,
        date: action.date,
        startTime: action.startTime,
        field: action.field,
        checkedInPlayerIds: action.playerIds,
        ratioPattern: action.ratioPattern,
        gameStartedAt: Date.now(),
        phase: 'pre-point',
        flipWinner: action.flipWinner ?? null,
        flipChoice: action.flipChoice ?? null,
        startingDirection: action.startingDirection ?? null,
        genderFlipWinner: action.genderFlipWinner ?? null,
      };

    case 'SET_LINEUP':
      // Lineups lock once the point starts — only MID_POINT_SUB can change onField during play
      if (state.phase === 'playing') return state;
      return { ...state, onField: action.lineup };

    case 'START_POINT':
      return { ...state, phase: 'playing', pointStartedAt: Date.now(), subDismissedAt: null };

    case 'SCORE': {
      const timeoutSubs = state.timeoutSubs || [];
      const finalSegment = timeoutSubs.length > 0
        ? { lineup: [...state.onField], startedAt: state.pointStartedAt, endedAt: Date.now() }
        : null;
      const pointStartedAt = timeoutSubs.length > 0 ? timeoutSubs[0].startedAt : state.pointStartedAt;

      const point = {
        number: state.currentPointNumber,
        lineup: [...state.onField],
        scoredBy: action.scoredBy,
        stats: [...state.currentStats],
        midPointSubs: [...state.midPointSubs],
        startedAt: pointStartedAt,
        endedAt: Date.now(),
        timeoutSubs: finalSegment ? [...timeoutSubs, finalSegment] : [],
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
        midPointSubs: [],
        timeoutSubs: [],
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
        midPointSubs: lastPoint.midPointSubs || [],
        timeoutSubs: [],
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

    case 'ADD_POINT_STAT': {
      const { pointIndex, playerId, statType } = action;
      // null or equal to current point count means we're adding to the live/current point
      if (pointIndex === null || pointIndex === state.points.length) {
        return {
          ...state,
          currentStats: [...state.currentStats, { playerId, type: statType }],
        };
      }
      // Adding to a historical point
      const updatedPoints = state.points.map((pt, i) => {
        if (i !== pointIndex) return pt;
        return { ...pt, stats: [...(pt.stats || []), { playerId, type: statType }] };
      });
      return { ...state, points: updatedPoints };
    }

    case 'REMOVE_POINT_STAT': {
      const { pointIndex, playerId, statType } = action;
      // null or equal to current point count means we're removing from the live/current point
      if (pointIndex === null || pointIndex === state.points.length) {
        const idx = state.currentStats.findLastIndex(
          s => s.playerId === playerId && s.type === statType
        );
        if (idx === -1) return state;
        const next = [...state.currentStats];
        next.splice(idx, 1);
        return { ...state, currentStats: next };
      }
      // Removing from a historical point
      const updatedPoints = state.points.map((pt, i) => {
        if (i !== pointIndex) return pt;
        const stats = pt.stats || [];
        const idx = stats.findLastIndex(s => s.playerId === playerId && s.type === statType);
        if (idx === -1) return pt;
        const next = [...stats];
        next.splice(idx, 1);
        return { ...pt, stats: next };
      });
      return { ...state, points: updatedPoints };
    }

    case 'MID_POINT_SUB': {
      const { outId, inId } = action;
      return {
        ...state,
        onField: state.onField.map(id => (id === outId ? inId : id)),
        midPointSubs: [
          ...state.midPointSubs,
          { outId, inId, timestamp: Date.now() },
        ],
      };
    }

    case 'SET_VIEWING_POINT':
      return { ...state, viewingPointIndex: action.index };

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
      return {
        ...state,
        phase: 'halftime',
        halftimeTaken: true,
        halftimeAfterPointCount: state.halftimeAfterPointCount ?? state.points.length,
      };

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

    case 'MARK_UNAVAILABLE': {
      const { playerId } = action;
      return {
        ...state,
        unavailablePlayerIds: [...new Set([...(state.unavailablePlayerIds || []), playerId])],
        onField: state.onField.filter(id => id !== playerId),
        checkedInPlayerIds: state.checkedInPlayerIds.filter(id => id !== playerId),
      };
    }

    case 'MARK_AVAILABLE': {
      const { playerId } = action;
      return {
        ...state,
        unavailablePlayerIds: (state.unavailablePlayerIds || []).filter(id => id !== playerId),
        checkedInPlayerIds: state.checkedInPlayerIds.includes(playerId)
          ? state.checkedInPlayerIds
          : [...state.checkedInPlayerIds, playerId],
      };
    }

    case 'EDIT_POINT_SCORED_BY': {
      const { pointIndex, scoredBy } = action;
      if (pointIndex < 0 || pointIndex >= state.points.length) return state;
      const oldPoint = state.points[pointIndex];
      if (oldPoint.scoredBy === scoredBy) return state;
      const updatedPoints = state.points.map((pt, i) =>
        i === pointIndex ? { ...pt, scoredBy } : pt
      );
      let ourScore = 0;
      let theirScore = 0;
      updatedPoints.forEach(pt => {
        if (pt.scoredBy === 'us') ourScore++;
        else theirScore++;
      });
      return { ...state, points: updatedPoints, ourScore, theirScore };
    }

    case 'TIMEOUT_START': {
      const segment = { lineup: [...state.onField], startedAt: state.pointStartedAt, endedAt: Date.now() };
      return {
        ...state,
        phase: 'timeout-sub',
        timeoutSubs: [...(state.timeoutSubs || []), segment],
        pointStartedAt: null,
        subDismissedAt: null,
      };
    }

    case 'RESUME_POINT':
      return { ...state, phase: 'playing', pointStartedAt: Date.now(), subDismissedAt: null };

    case 'EDIT_POINT_LINEUP': {
      const updatedPoints = state.points.map((pt, i) =>
        i === action.pointIndex ? { ...pt, lineup: action.lineup } : pt
      );
      return { ...state, points: updatedPoints };
    }

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, rawDispatch] = useReducer(gameReducer, initialState);

  // Restore active game on mount (session recovery via Firestore offline cache)
  useEffect(() => {
    getDoc(doc(db, 'activeGame', 'current')).then(snap => {
      if (snap.exists()) {
        rawDispatch({ type: 'RESTORE', state: snap.data() });
      }
    }).catch(() => {});
  }, []);

  const dispatch = useCallback(action => {
    rawDispatch(action);
  }, []);

  // Persist on every state change (debounced to limit Firestore writes)
  useEffect(() => {
    if (!state.active) return;
    const timer = setTimeout(() => {
      setDoc(doc(db, 'activeGame', 'current'), state).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
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
    await setDoc(doc(db, 'games', String(state.id)), gameRecord);
    await deleteDoc(doc(db, 'activeGame', 'current'));
    rawDispatch({ type: 'CLEAR_GAME' });
  }, [state]);

  const deleteAndExitGame = useCallback(async () => {
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
      status: 'deleted',
      deleted: true,
    };
    await setDoc(doc(db, 'games', String(state.id)), gameRecord);
    await deleteDoc(doc(db, 'activeGame', 'current'));
    rawDispatch({ type: 'CLEAR_GAME' });
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch, saveAndEndGame, deleteAndExitGame }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
