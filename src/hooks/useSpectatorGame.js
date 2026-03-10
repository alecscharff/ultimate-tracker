import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useSpectatorGame() {
  const [game, setGame] = useState(undefined); // undefined=loading, null=no game

  useEffect(() => {
    return onSnapshot(
      doc(db, 'activeGame', 'current'),
      (snap) => {
        setGame(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.error('Spectator game listener error:', error);
        setGame(null);
      }
    );
  }, []);

  return game;
}
