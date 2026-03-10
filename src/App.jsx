import { useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './screens/Login';
import Home from './screens/Home';
import Roster from './screens/Roster';
import GameSetup from './screens/GameSetup';
import GameView from './screens/GameView2';
import PastGames from './screens/PastGames';
import ManualGameEntry from './screens/ManualGameEntry';
import SkillDevelopment from './screens/SkillDevelopment';
import PlayerSkillDetail from './screens/PlayerSkillDetail';
import SpectatorView from './screens/SpectatorView';
import { setSetting } from './services/settingsService';

function AppRoutes() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

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

  if (user === undefined) {
    return (
      <Routes>
        <Route path="/watch/:gameId" element={<SpectatorView />} />
        <Route path="*" element={
          <div className="min-h-dvh flex items-center justify-center">
            <div className="text-navy-400 text-sm">Loading…</div>
          </div>
        } />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/watch/:gameId" element={<SpectatorView />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/roster" element={<Roster />} />
      <Route path="/game/setup" element={<GameSetup />} />
      <Route path="/game/play" element={<GameView />} />
      <Route path="/games" element={<PastGames />} />
      <Route path="/games/add" element={<ManualGameEntry />} />
      <Route path="/skills" element={<SkillDevelopment />} />
      <Route path="/skills/:playerId" element={<PlayerSkillDetail />} />
      <Route path="/watch/:gameId" element={<SpectatorView />} />
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
