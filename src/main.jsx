import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { GameProvider } from './context/GameContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/ultimate-tracker">
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Dismiss loading splash
const splash = document.getElementById('loading-splash');
if (splash) {
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 400);
}
