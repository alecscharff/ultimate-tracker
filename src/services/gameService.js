import { doc, updateDoc, collection, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function updateGamePoints(gameId, points) {
  const ourScore = points.filter(p => p.scoredBy === 'us').length;
  const theirScore = points.filter(p => p.scoredBy === 'them').length;
  return updateDoc(doc(db, 'games', String(gameId)), { points, ourScore, theirScore });
}

export async function softDeleteGame(gameId) {
  return updateDoc(doc(db, 'games', String(gameId)), {
    deleted: true,
    status: 'deleted',
  });
}

export async function createScheduledGame({ opponent, date, startTime, field }) {
  const spectatorId = Date.now();
  const docRef = await addDoc(collection(db, 'scheduledGames'), {
    spectatorId,
    opponent,
    date,
    startTime,
    field,
  });
  return { id: docRef.id, spectatorId, opponent, date, startTime, field };
}

export async function deleteScheduledGame(id) {
  return deleteDoc(doc(db, 'scheduledGames', id));
}
