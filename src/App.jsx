import { useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './screens/Login';
import Home from './screens/Home';
import Roster from './screens/Roster';
import GameSetup from './screens/GameSetup';
import GameView from './screens/GameView';
import PastGames from './screens/PastGames';
import { setSetting } from './services/settingsService';

function AppRoutes() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle ?sheet= deep link after sign-in
  useEffect(() => {
    if (!user) return;
    const sheetParam = searchParams.get('sheet');
    if (sheetParam) {
      setSetting('rosterSheetUrl', sheetParam)
        .then(() => setSetting('scheduleSheetUrl', sheetParam))
        .then(() => setSearchParams({}, { replace: true }))
        .catch(() => {});
    }
  }, [user]);

  // Still determining auth state
  if (user === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-navy-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/roster" element={<Roster />} />
      <Route path="/game/setup" element={<GameSetup />} />
      <Route path="/game/play" element={<GameView />} />
      <Route path="/games" element={<PastGames />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh bg-navy-950 text-white font-body">
      <AppRoutes />
    </div>
  );
}
