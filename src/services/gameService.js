import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function softDeleteGame(gameId) {
  return updateDoc(doc(db, 'games', String(gameId)), {
    deleted: true,
    status: 'deleted',
  });
}
