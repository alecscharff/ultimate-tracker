import { useParams, useNavigate } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { useCertifications } from '../hooks/useCertifications';
import { SKILL_LEVELS } from '../data/skillLevels';
import {
  toggleCheckpoint,
  setHomeQuizReviewed,
  markPassed,
  setPartner,
} from '../services/certificationService';

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PlayerSkillDetail() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const players = usePlayers();
  const certMap = useCertifications();

  const player = players.find(p => p.id === playerId);
  const otherPlayers = players.filter(p => p.id !== playerId);

  // cert for a given level: cert doc or null
  function getCert(level) {
    const playerCerts = certMap.get(playerId);
    if (!playerCerts) return null;
    return playerCerts.get(level) ?? null;
  }

  async function handleToggleCheckpoint(level, checkpointKey) {
    await toggleCheckpoint(playerId, level, checkpointKey);
  }

  async function handleQuizToggle(level, cert) {
    const next = !(cert?.homeQuizReviewed ?? false);
    await setHomeQuizReviewed(playerId, level, next);
  }

  async function handleMarkPassed(level, player, cert) {
    const confirmed = window.confirm(
      `Mark ${player.name} as certified for Level ${level}?`
    );
    if (!confirmed) return;
    await markPassed(playerId, level, true);
  }

  async function handleUndoPassed(level) {
    await markPassed(playerId, level, false);
  }

  async function handlePartnerChange(level, partnerId) {
    await setPartner(playerId, level, partnerId || null);
  }

  if (!player) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-navy-400 text-sm">Loading player…</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-navy-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-navy-300 active:text-white text-2xl leading-none"
          style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &larr;
        </button>
        <h1 className="font-display text-xl truncate">
          {player.name} &mdash; Skills
        </h1>
      </div>

      {/* Level cards */}
      <div className="px-4 pt-4 space-y-4">
        {SKILL_LEVELS.map(levelConfig => {
          if (levelConfig.placeholder) {
            return (
              <PlaceholderLevelCard key={levelConfig.level} levelConfig={levelConfig} />
            );
          }

          const cert = getCert(levelConfig.level);
          const checkpoints = cert?.checkpoints ?? {};
          const totalCheckpoints = levelConfig.partB.checkpoints.length;
          const checkedCount = levelConfig.partB.checkpoints.filter(
            cp => checkpoints[cp.key]
          ).length;
          const quizReviewed = cert?.homeQuizReviewed ?? false;
          const allCheckpointsDone = checkedCount === totalCheckpoints;
          const isReady = allCheckpointsDone && quizReviewed;
          const isPassed = cert?.passed ?? false;

          return (
            <div
              key={levelConfig.level}
              className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden"
            >
              {/* Card header */}
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-white font-display text-xl">{levelConfig.title}</h2>
                <p className="text-navy-300 text-sm">{levelConfig.subtitle}</p>
              </div>

              <div className="px-4 pb-4 space-y-4">
                {/* Part A: Home Quiz */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2">
                    {levelConfig.partA.label}
                  </h3>

                  {/* Quiz questions */}
                  <ul className="space-y-1 mb-3">
                    {levelConfig.partA.questions.map(q => (
                      <li key={q.key} className="text-navy-300 text-sm italic">
                        {q.text}
                      </li>
                    ))}
                  </ul>

                  {/* Reviewed checkbox */}
                  <label
                    className="flex items-start gap-3 cursor-pointer"
                    style={{ minHeight: '44px' }}
                  >
                    <input
                      type="checkbox"
                      checked={quizReviewed}
                      onChange={() => handleQuizToggle(levelConfig.level, cert)}
                      className="mt-0.5 shrink-0"
                      style={{
                        width: '20px',
                        height: '20px',
                        accentColor: '#f5a623',
                        cursor: 'pointer',
                      }}
                    />
                    <span className="text-sm text-white">
                      Reviewed with parent, ready to test
                    </span>
                  </label>

                  {quizReviewed && cert?.homeQuizTimestamp && (
                    <p className="text-score-green text-xs mt-1 ml-8">
                      Reviewed on {formatDate(cert.homeQuizTimestamp)}
                    </p>
                  )}
                </div>

                {/* Part B: Practice Evaluation */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2">
                    {levelConfig.partB.label}
                  </h3>

                  <div className="space-y-2">
                    {levelConfig.partB.checkpoints.map(cp => {
                      const checked = checkpoints[cp.key] ?? false;
                      return (
                        <label
                          key={cp.key}
                          className="flex items-start gap-3 cursor-pointer"
                          style={{ minHeight: '44px' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              handleToggleCheckpoint(levelConfig.level, cp.key)
                            }
                            className="mt-0.5 shrink-0"
                            style={{
                              width: '20px',
                              height: '20px',
                              accentColor: '#f5a623',
                              cursor: 'pointer',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white font-medium">
                              {cp.label}
                            </span>
                            <p className="text-xs text-navy-300 mt-0.5">
                              {cp.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-navy-300 mb-1">
                      <span>{checkedCount}/{totalCheckpoints} checkpoints</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gold transition-all duration-300"
                        style={{
                          width: totalCheckpoints > 0
                            ? `${(checkedCount / totalCheckpoints) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Level 2: Partner selector */}
                {levelConfig.partnerRequired && (
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">
                      Testing Partner
                    </h3>
                    {levelConfig.partnerNote && (
                      <p className="text-navy-300 text-xs mb-2">
                        {levelConfig.partnerNote}
                      </p>
                    )}
                    <select
                      value={cert?.partnerId ?? ''}
                      onChange={e => handlePartnerChange(levelConfig.level, e.target.value)}
                      className="w-full text-sm"
                    >
                      <option value="">— Select a partner —</option>
                      {otherPlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Certification status */}
                <div>
                  {isPassed ? (
                    <div className="bg-score-green/10 border border-score-green/30 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-score-green font-semibold text-sm">
                          &#10003; Certified on {formatDate(cert?.passedTimestamp)}
                        </p>
                        {cert?.certifiedByCoachEmail && (
                          <p className="text-score-green/70 text-xs mt-0.5">
                            by {cert.certifiedByCoachEmail}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUndoPassed(levelConfig.level)}
                        className="text-xs text-navy-300 underline underline-offset-2 active:text-white shrink-0"
                        style={{ minHeight: '36px' }}
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        isReady && handleMarkPassed(levelConfig.level, player, cert)
                      }
                      disabled={!isReady}
                      className={isReady ? 'btn-gold w-full' : 'btn w-full bg-navy-700 text-navy-400 cursor-not-allowed'}
                    >
                      Mark as Certified
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderLevelCard({ levelConfig }) {
  return (
    <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden opacity-50">
      <div className="px-4 py-4 flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-white font-display text-xl">{levelConfig.title}</h2>
            <span className="text-xs font-semibold bg-navy-700 text-navy-300 px-2 py-0.5 rounded-full">
              Coming Soon
            </span>
          </div>
          <p className="text-navy-300 text-sm">{levelConfig.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
