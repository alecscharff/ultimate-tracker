import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Returns Map<playerId, Map<level, CertificationDoc>>
// Real-time listener that mirrors the usePlayers.js pattern.
export function useCertifications() {
  const [certMap, setCertMap] = useState(new Map());

  useEffect(() => {
    return onSnapshot(collection(db, 'certifications'), snap => {
      const map = new Map();
      snap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const { playerId, level } = data;
        if (!map.has(playerId)) {
          map.set(playerId, new Map());
        }
        map.get(playerId).set(level, data);
      });
      setCertMap(map);
    });
  }, []);

  return certMap;
}
