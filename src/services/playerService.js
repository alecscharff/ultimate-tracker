import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function addPlayer(player) {
  return addDoc(collection(db, 'players'), player);
}

export async function updatePlayer(id, data) {
  return updateDoc(doc(db, 'players', id), data);
}

export async function deletePlayer(id) {
  return deleteDoc(doc(db, 'players', id));
}

export async function bulkAddPlayers(players) {
  return Promise.all(players.map(p => addPlayer(p)));
}
