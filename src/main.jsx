import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './context/GameContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Dismiss loading splash
const splash = document.getElementById('loading-splash');
if (splash) {
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 400);
}
