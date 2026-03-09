import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function getSetting(key) {
  const snap = await getDoc(doc(db, 'settings', key));
  return snap.exists() ? snap.data().value : null;
}

export async function setSetting(key, value) {
  return setDoc(doc(db, 'settings', key), { value });
}
