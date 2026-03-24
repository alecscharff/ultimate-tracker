import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, ACTIONS } from '../context/GameContext';
import { getPointFlipInfo } from '../utils/gameUtils';
import { usePlayers } from '../hooks/usePlayers';
import { previewFutureLineups, suggestLineup } from '../utils/lineup';
import { syncGameToSheet } from '../utils/sheetsSync';
import Scoreboard from '../components/Scoreboard';
import AlertBanner from '../components/AlertBanner';
import SubModal from '../components/SubModal';
import PointStrip from '../components/PointStrip';
import PointDetailView from '../components/PointDetailView';
import GameActionBar from '../components/GameActionBar';
import GameSummaryModal from '../components/GameSummaryModal';

export default function GameView2() {
  const navigate = useNavigate();
  const { state, dispatch, saveAndEndGame, deleteAndExitGame } = useGame();
  const players = usePlayers();

  const [selectedPointIndex, setSelectedPointIndex] = useState(null); // null = current live point
  const [sittingOutIds, setSittingOutIds] = useState(new Set());
  const [showSubModal, setShowSubModal] = useState(false);
  const [showGameSummary, setShowGameSummary] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(null);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Auto-reset to current point after a score, and clear sitting-out players
  useEffect(() => {
    setSelectedPointIndex(null);
    setSittingOutIds(new Set());
  }, [state.ourScore, state.theirScore]);

  // Auto-suggest lineup when entering pre-point or timeout-sub with empty onField
  useEffect(() => {
    if (
      (state.phase === 'pre-point' || state.phase === 'timeout-sub') &&
      state.onField.length === 0 &&
      players.length > 0
    ) {
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

  const currentPointFlip = useMemo(() => {
    if (!state.startingDirection && !state.flipWinner) return null;
    return getPointFlipInfo(state.points.length, state);
  }, [state.startingDirection, state.flipWinner, state.flipChoice, state.halftimeAfterPointCount, state.points]);

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
    const availableIds = state.checkedInPlayerIds.filter(id => !sittingOutIds.has(id));
    const suggested = suggestLineup(
      players, availableIds, currentRatio, state.points, state.equalizeBy
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
    dispatch({ type: ACTIONS.TIMEOUT_START });
  }

  function handleResumePoint() {
    dispatch({ type: ACTIONS.RESUME_POINT });
  }

  function handleUndo() {
    if (!undoAvailable) return;
    dispatch({ type: ACTIONS.UNDO_SCORE });
    setUndoAvailable(null);
  }

  async function handleEndGame() {
    setShowGameSummary(true);
  }

  async function confirmEndGame() {
    await saveAndEndGame();
    syncGameToSheet(state, players).catch(() => {});
    navigate('/');
  }

  function handleAcceptSub() {
    // MID_POINT_SUB one-by-one because SET_LINEUP is blocked during 'playing' phase
    const currentLineup = state.onField;
    subSuggestion.forEach((inId, i) => {
      const outId = currentLineup[i];
      if (outId && outId !== inId) {
        dispatch({ type: ACTIONS.MID_POINT_SUB, outId, inId });
      }
    });
    setShowSubModal(false);
  }

  function handleSelectPoint(index) {
    setSelectedPointIndex(index);
  }

  async function handleDeleteGame() {
    await deleteAndExitGame();
    navigate('/');
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

      {/* Share live link + Exit & Delete */}
      <div className="flex justify-between px-4 py-1">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-xs text-score-red/50 flex items-center gap-1 active:text-score-red transition-colors"
          style={{ minHeight: 32 }}
        >
          Exit & Delete
        </button>
        <button
          onClick={handleShareLink}
          className="text-xs text-navy-300 flex items-center gap-1 active:text-gold transition-colors"
          style={{ minHeight: 32 }}
        >
          {copied ? <span className="text-gold font-semibold">Link Copied!</span> : <span>Share Live Link</span>}
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

      {/* Timeout banner — shown during timeout-sub phase */}
      {state.phase === 'timeout-sub' && isViewingCurrentPoint && (
        <div className="bg-gold/20 border-b border-gold/40 px-4 py-2 flex items-center gap-2">
          <span className="text-sm font-bold text-gold">TIMEOUT</span>
          <span className="text-xs text-navy-300">— adjust lineup for resume</span>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Direction/pull indicator — shown during pre-point */}
        {isViewingCurrentPoint && state.phase === 'pre-point' && currentPointFlip && (currentPointFlip.direction || currentPointFlip.puller) && (
          <div className="flex items-center gap-3 py-2 mb-3 border-b border-navy-700/50">
            {currentPointFlip.direction && (
              <span className="font-display text-2xl text-gold leading-none">
                {currentPointFlip.direction === 'right' ? '→' : '←'}
              </span>
            )}
            {currentPointFlip.puller && (
              <span className="text-xs text-navy-300">
                {currentPointFlip.puller === 'us' ? 'Marmots pull' : `${state.opponent} pulls`}
              </span>
            )}
          </div>
        )}

        <PointDetailView
          gameState={state}
          players={players}
          selectedPointIndex={selectedPointIndex}
          futureLineups={futureLineups}
          dispatch={dispatch}
          sittingOutIds={sittingOutIds}
          onSitPlayer={(id) => setSittingOutIds(prev => new Set([...prev, id]))}
          onUnsitPlayer={(id) => setSittingOutIds(prev => { const next = new Set(prev); next.delete(id); return next; })}
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
        onResumePoint={handleResumePoint}
        onEndGame={handleEndGame}
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

      {/* Game summary modal — shown before saving */}
      {showGameSummary && (
        <GameSummaryModal
          gameState={state}
          players={players}
          onConfirmEnd={confirmEndGame}
          onGoBack={() => setShowGameSummary(false)}
        />
      )}

      {/* Delete game confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-navy-800 rounded-xl p-5 max-w-sm mx-4 w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-score-red">Exit & Delete Game?</p>
            <p className="text-xs text-navy-300 leading-relaxed">
              This will end the current game and remove it from your history. Game data is saved with a deleted flag but will not appear in past games.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-primary flex-1" style={{ minHeight: 44 }}>
                Cancel
              </button>
              <button
                onClick={handleDeleteGame}
                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-score-red text-white active:bg-score-red/80 transition-colors"
                style={{ minHeight: 44 }}
              >
                Delete & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
