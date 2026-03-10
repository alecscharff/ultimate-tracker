import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { useCertifications } from '../hooks/useCertifications';
import { ACTIVE_LEVELS } from '../data/skillLevels';
import CertBadge from '../components/CertBadge';

function getCertStatus(certMap, playerId, level) {
  const playerCerts = certMap.get(playerId);
  if (!playerCerts) return 'none';
  const cert = playerCerts.get(level);
  if (!cert) return 'none';
  if (cert.passed) return 'passed';
  // In-progress: any checkpoint checked or quiz reviewed
  const hasProgress =
    cert.homeQuizReviewed ||
    Object.values(cert.checkpoints || {}).some(Boolean);
  return hasProgress ? 'in-progress' : 'none';
}

function getLatestEvaluation(certMap, playerId) {
  const playerCerts = certMap.get(playerId);
  if (!playerCerts) return null;
  let latest = 0;
  for (const cert of playerCerts.values()) {
    if (cert.lastEvaluatedAt && cert.lastEvaluatedAt > latest) {
      latest = cert.lastEvaluatedAt;
    }
  }
  if (!latest) return null;
  return new Date(latest).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export default function SkillDevelopment() {
  const navigate = useNavigate();
  const players = usePlayers();
  const certMap = useCertifications();

  // Filter tabs: 'all' | 1 | 2
  const [filter, setFilter] = useState('all');

  const filteredPlayers =
    filter === 'all'
      ? players
      : players.filter(player => {
          const status = getCertStatus(certMap, player.id, filter);
          // Show all players regardless — filter just highlights the level column
          return true;
        });

  return (
    <div className="min-h-dvh pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-navy-300 active:text-white text-2xl leading-none"
          style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &larr;
        </button>
        <h1 className="font-display text-2xl">SKILL DEVELOPMENT</h1>
        <span className="text-navy-300 text-sm ml-auto">{players.length} players</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-gold text-navy-950'
              : 'bg-navy-800 text-navy-300 active:text-white'
          }`}
          style={{ minHeight: '36px' }}
        >
          All
        </button>
        {ACTIVE_LEVELS.map(lvl => (
          <button
            key={lvl.level}
            onClick={() => setFilter(lvl.level)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === lvl.level
                ? 'bg-gold text-navy-950'
                : 'bg-navy-800 text-navy-300 active:text-white'
            }`}
            style={{ minHeight: '36px' }}
          >
            L{lvl.level}
          </button>
        ))}
      </div>

      {/* Player list */}
      <div className="px-4 mt-2 space-y-2">
        {filteredPlayers.map(player => {
          const latestEval = getLatestEvaluation(certMap, player.id);
          return (
            <button
              key={player.id}
              onClick={() => navigate(`/skills/${player.id}`)}
              className="card w-full px-4 py-3 flex items-center gap-3 text-left active:bg-navy-700 transition-colors"
              style={{ minHeight: '52px' }}
            >
              {/* Player info */}
              <div className="flex-1 min-w-0">
                {/* Name, gender, grade line */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{player.name}</span>
                  <span
                    className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      player.gender === 'gx' ? 'bg-purple-600' : 'bg-navy-600'
                    }`}
                  >
                    {player.gender}
                  </span>
                  <span className="text-[11px] text-navy-300 font-mono">G{player.grade}</span>
                </div>
                {/* Last evaluated line */}
                {latestEval && (
                  <p className="text-[10px] text-navy-500 mt-0.5 truncate">
                    Last eval: {latestEval}
                  </p>
                )}
              </div>

              {/* Cert badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {ACTIVE_LEVELS.map(lvl => (
                  <CertBadge
                    key={lvl.level}
                    level={lvl.level}
                    status={getCertStatus(certMap, player.id, lvl.level)}
                  />
                ))}
              </div>

              {/* Chevron */}
              <span className="text-navy-500 text-lg leading-none ml-1">›</span>
            </button>
          );
        })}

        {players.length === 0 && (
          <div className="text-center text-navy-400 py-12">
            No players on roster yet. Add players from the Roster screen.
          </div>
        )}
      </div>
    </div>
  );
}
