import { doc, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
