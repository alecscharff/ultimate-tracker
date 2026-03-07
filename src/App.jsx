import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import Roster from './screens/Roster';
import GameSetup from './screens/GameSetup';
import GameView from './screens/GameView';
import PastGames from './screens/PastGames';

export default function App() {
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
