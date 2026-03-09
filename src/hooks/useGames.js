import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export function useGames() {
  const [games, setGames] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('endedAt', 'desc'));
    return onSnapshot(q, snap => {
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);
  return games;
}
