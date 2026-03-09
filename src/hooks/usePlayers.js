import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export function usePlayers() {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('name'));
    return onSnapshot(q, snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);
  return players;
}
