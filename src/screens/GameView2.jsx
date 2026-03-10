import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, ACTIONS } from '../context/GameContext';
import { usePlayers } from '../hooks/usePlayers';
import { previewFutureLineups, suggestLineup } from '../utils/lineup';
import { syncGameToSheet } from '../utils/sheetsSync';
import Scoreboard from '../components/Scoreboard';
import AlertBanner from '../components/AlertBanner';
import SubModal from '../components/SubModal';
import PointStrip from '../components/PointStrip';
import PointDetailView from '../components/PointDetailView';
import GameActionBar from '../components/GameActionBar';

export default function GameView2() {
  const navigate = useNavigate();
  const { state, dispatch, saveAndEndGame } = useGame();
  const players = usePlayers();

  const [selectedPointIndex, setSelectedPointIndex] = useState(null); // null = current live point
  const [showSubModal, setShowSubModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(null);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  // Clock tick for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if no active game (and not finished)
  useEffect(() => {
    if (!state.active && state.phase !== 'finished') {
      navigate('/');
    }
  }, [state.active, state.phase, navigate]);

  // Auto-reset to current point after a score
  useEffect(() => {
    setSelectedPointIndex(null);
  }, [state.ourScore, state.theirScore]);

  // Auto-suggest lineup when entering pre-point with empty onField
  useEffect(() => {
    if (state.phase === 'pre-point' && state.onField.length === 0 && players.length > 0) {
      const currentRatio = state.ratioOverride || state.ratioPattern[state.ratioIndex % state.ratioPattern.length];
      const suggested = suggestLineup(
        players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy
      );
      if (suggested.length > 0) {
        dispatch({ type: ACTIONS.SET_LINEUP, lineup: suggested });
      }
    }
  }, [state.phase, state.onField.length, players.length]);

  // 10-min sub suggestion trigger
  const pointElapsedMinutes = state.pointStartedAt ? (Date.now() - state.pointStartedAt) / 60000 : 0;
  useEffect(() => {
    if (state.phase === 'playing' && pointElapsedMinutes >= 10) {
      if (!state.subDismissedAt || (Date.now() - state.subDismissedAt) > 120000) {
        setShowSubModal(true);
      }
    }
  }, [state.phase, Math.floor(pointElapsedMinutes), state.subDismissedAt]);

  // Undo auto-dismiss after 8 seconds
  useEffect(() => {
    if (undoAvailable) {
      const timer = setTimeout(() => setUndoAvailable(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [undoAvailable]);

  // Future lineups preview
  const futureLineups = useMemo(() => {
    if (players.length === 0) return [];
    return previewFutureLineups(
      players,
      state.checkedInPlayerIds,
      state.ratioPattern,
      state.ratioIndex,
      state.points,
      5
    );
  }, [players, state.checkedInPlayerIds, state.ratioPattern, state.ratioIndex, state.points]);

  // Sub suggestion lineup
  const currentRatio = state.ratioOverride || state.ratioPattern[state.ratioIndex % state.ratioPattern.length];
  const subSuggestion = useMemo(() => {
    if (!showSubModal || players.length === 0) return [];
    return suggestLineup(players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy);
  }, [showSubModal, players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy]);

  // Game time alerts
  const gameElapsed = state.gameStartedAt ? (Date.now() - state.gameStartedAt) / 60000 : 0;
  const alerts = [];

  if (!state.halftimeTaken) {
    if (state.ourScore >= 6 || state.theirScore >= 6) {
      alerts.push({
        type: 'warning',
        message: 'Halftime — a team reached 6 points',
        action: 'halftime',
      });
    } else if (gameElapsed >= 30) {
      const halfTarget = Math.max(state.ourScore, state.theirScore) + 1;
      alerts.push({
        type: 'warning',
        message: `Half cap reached (30 min). Target: ${halfTarget}`,
        action: 'halftime',
      });
    }
  }
  if (gameElapsed >= 60) {
    alerts.push({ type: 'danger', message: 'HARD CAP — 60 minutes. Finish current point.' });
  } else if (gameElapsed >= 55) {
    alerts.push({ type: 'warning', message: `Hard cap in ${Math.ceil(60 - gameElapsed)} min` });
  }

  // Action handlers
  function handleAutoPickLineup() {
    const suggested = suggestLineup(
      players, state.checkedInPlayerIds, currentRatio, state.points, state.equalizeBy
    );
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: suggested });
  }

  function handleStartPoint() {
    if (state.onField.length === 0) return;
    dispatch({ type: ACTIONS.START_POINT });
  }

  function handleWeScored() {
    dispatch({ type: ACTIONS.SCORE, scoredBy: 'us' });
    setUndoAvailable({ scoredBy: 'us' });
  }

  function handleTheyScored() {
    dispatch({ type: ACTIONS.SCORE, scoredBy: 'them' });
    setUndoAvailable({ scoredBy: 'them' });
  }

  function handleTimeout() {
    setShowSubModal(true);
  }

  function handleUndo() {
    if (!undoAvailable) return;
    dispatch({ type: ACTIONS.UNDO_SCORE });
    setUndoAvailable(null);
  }

  async function handleEndGame() {
    await saveAndEndGame();
    syncGameToSheet(state, players).catch(() => {});
    navigate('/');
  }

  function handleAcceptSub() {
    dispatch({ type: ACTIONS.SET_LINEUP, lineup: subSuggestion });
    setShowSubModal(false);
  }

  function handleSelectPoint(index) {
    setSelectedPointIndex(index);
  }

  function handleShareLink() {
    const url = `${window.location.origin}/watch/${state.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  }

  const isViewingCurrentPoint = selectedPointIndex === null;

  if (!state.active && state.phase !== 'finished') return null;

  // Finished phase — show the end-game overlay instead of the normal game view
  if (state.phase === 'finished') {
    return (
      <div className="min-h-dvh flex flex-col bg-navy-950 text-white">
        <Scoreboard
          ourScore={state.ourScore}
          theirScore={state.theirScore}
          opponent={state.opponent}
          gameStartedAt={state.gameStartedAt}
          pointStartedAt={state.pointStartedAt}
          phase={state.phase}
          currentPointNumber={state.currentPointNumber}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm">
            <h2 className="font-display text-4xl mb-2">
              {state.ourScore > state.theirScore ? (
                <span className="text-score-green">VICTORY</span>
              ) : state.ourScore < state.theirScore ? (
                <span className="text-score-red">DEFEAT</span>
              ) : (
                <span className="text-gold">TIE GAME</span>
              )}
            </h2>
            <div className="font-display text-6xl text-white my-4">
              {state.ourScore} - {state.theirScore}
            </div>
            <p className="text-navy-300 mb-8">vs {state.opponent}</p>
            {showEndConfirm ? (
              <div className="card p-4 border-score-red/50 space-y-3 mb-4">
                <p className="text-sm text-center">End game and save? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={handleEndGame} className="flex-1 btn bg-score-red text-white">
                    Confirm End
                  </button>
                  <button onClick={() => setShowEndConfirm(false)} className="flex-1 btn-primary">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="btn-gold w-full text-lg"
                style={{ minHeight: 52 }}
              >
                Save & Exit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Halftime overlay
  if (state.phase === 'halftime') {
    return (
      <div className="min-h-dvh flex flex-col bg-navy-950 text-white">
        <Scoreboard
          ourScore={state.ourScore}
          theirScore={state.theirScore}
          opponent={state.opponent}
          gameStartedAt={state.gameStartedAt}
          pointStartedAt={state.pointStartedAt}
          phase={state.phase}
          currentPointNumber={state.currentPointNumber}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="font-display text-4xl text-gold mb-2">HALFTIME</h2>
            <p className="text-navy-300 mb-6">
              {state.ourScore} - {state.theirScore} vs {state.opponent}
            </p>
            <button
              onClick={() => dispatch({ type: ACTIONS.END_HALFTIME })}
              className="btn-gold text-lg px-10"
            >
              Resume Play
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-navy-950 text-white">
      {/* Scoreboard — sticky at top */}
      <Scoreboard
        ourScore={state.ourScore}
        theirScore={state.theirScore}
        opponent={state.opponent}
        gameStartedAt={state.gameStartedAt}
        pointStartedAt={state.pointStartedAt}
        phase={state.phase}
        currentPointNumber={state.currentPointNumber}
      />

      {/* Share live link */}
      <div className="flex justify-end px-4 py-1">
        <button
          onClick={handleShareLink}
          className="text-xs text-navy-300 flex items-center gap-1 active:text-gold transition-colors"
          style={{ minHeight: 32 }}
        >
          {copied ? <span className="text-gold font-semibold">Link Copied!</span> : <span>📤 Share Live Link</span>}
        </button>
      </div>

      {/* Undo banner */}
      {undoAvailable && (
        <div className="bg-gold/20 border-b border-gold/40 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gold">
            {undoAvailable.scoredBy === 'us' ? 'Marmots' : 'Opponent'} scored
          </span>
          <button
            onClick={handleUndo}
            className="text-xs font-bold uppercase px-4 py-2 rounded-lg bg-gold text-navy-950 active:bg-gold-light"
            style={{ minHeight: 36 }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Alert banners */}
      {alerts.map((alert, i) => (
        <AlertBanner
          key={i}
          type={alert.type}
          message={alert.message}
          onAction={alert.action === 'halftime' ? () => dispatch({ type: ACTIONS.START_HALFTIME }) : undefined}
          actionLabel={alert.action === 'halftime' ? 'Take Half' : undefined}
        />
      ))}

      {/* Point strip */}
      <PointStrip
        points={state.points}
        currentPointNumber={state.currentPointNumber}
        ourScore={state.ourScore}
        theirScore={state.theirScore}
        selectedIndex={selectedPointIndex}
        futureLineups={futureLineups}
        onSelectPoint={handleSelectPoint}
        phase={state.phase}
      />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <PointDetailView
          gameState={state}
          players={players}
          selectedPointIndex={selectedPointIndex}
          futureLineups={futureLineups}
          dispatch={dispatch}
        />
      </div>

      {/* Fixed bottom action bar */}
      <GameActionBar
        phase={state.phase}
        isViewingCurrentPoint={isViewingCurrentPoint}
        onAutoPickLineup={handleAutoPickLineup}
        onStartPoint={handleStartPoint}
        onWeScored={handleWeScored}
        onTheyScored={handleTheyScored}
        onTimeout={handleTimeout}
        onEndGame={() => setShowEndConfirm(true)}
        onBackToCurrent={() => setSelectedPointIndex(null)}
      />

      {/* Sub suggestion modal */}
      <SubModal
        isOpen={showSubModal}
        suggestedLineup={subSuggestion}
        players={players}
        currentLineup={state.onField}
        onAccept={handleAcceptSub}
        onDismiss={() => {
          setShowSubModal(false);
          dispatch({ type: ACTIONS.DISMISS_SUB });
        }}
      />
    </div>
  );
}
