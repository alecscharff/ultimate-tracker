import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useScheduledGames() {
  const [scheduledGames, setScheduledGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'scheduledGames'), orderBy('date', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setScheduledGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return { scheduledGames, loading };
}
