import { useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Home from './screens/Home';
import Roster from './screens/Roster';
import GameSetup from './screens/GameSetup';
import GameView from './screens/GameView';
import PastGames from './screens/PastGames';
import db from './db';

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const sheetParam = searchParams.get('sheet');
    if (sheetParam) {
      db.settings.put({ key: 'rosterSheetUrl', value: sheetParam })
        .then(() => db.settings.put({ key: 'scheduleSheetUrl', value: sheetParam }))
        .then(() => setSearchParams({}, { replace: true }))
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-dvh bg-navy-950 text-white font-body">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/game/setup" element={<GameSetup />} />
        <Route path="/game/play" element={<GameView />} />
        <Route path="/games" element={<PastGames />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
