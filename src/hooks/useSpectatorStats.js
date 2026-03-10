import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useSpectatorStats(gameId) {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    if (!gameId) return;
    const q = query(
      collection(db, 'spectatorStats'),
      where('gameId', '==', String(gameId))
    );
    return onSnapshot(q, (snap) => {
      setStats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [gameId]);

  const addSpectatorStat = useCallback(async ({
    gameId: gId,
    pointIndex,
    playerId,
    type,
    nickname,
    coachStats = [],
  }) => {
    // Merge coach stats + spectator stats for this point
    const pointSpectatorStats = stats.filter(s => s.pointIndex === pointIndex);
    const allPointStats = [...coachStats, ...pointSpectatorStats];

    // GOAL: Only one goal per point total
    if (type === 'goal') {
      const existingGoal = allPointStats.find(s => s.type === 'goal');
      if (existingGoal) {
        return { success: false, reason: 'A goal has already been recorded for this point.' };
      }
    }

    // ASSIST: One per point per player
    if (type === 'assist') {
      const existingAssist = allPointStats.find(
        s => s.type === 'assist' && s.playerId === playerId
      );
      if (existingAssist) {
        return { success: false, reason: 'This player already has an assist for this point.' };
      }
    }

    // D: Duplicate if same player+point within last 30 seconds
    if (type === 'D') {
      const now = Date.now();
      const recentDupe = pointSpectatorStats.find(
        s => s.type === 'D' && s.playerId === playerId && (now - s.timestamp) < 30000
      );
      if (recentDupe) {
        return { success: false, reason: 'A D for this player was just recorded.' };
      }
    }

    await addDoc(collection(db, 'spectatorStats'), {
      gameId: String(gId),
      pointIndex,
      playerId,
      type,
      nickname,
      timestamp: Date.now(),
    });

    return { success: true };
  }, [stats]);

  return { spectatorStats: stats, addSpectatorStat };
}
