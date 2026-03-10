import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

function certDocId(playerId, level) {
  return `${playerId}_L${level}`;
}

function certDocRef(playerId, level) {
  return doc(db, 'certifications', certDocId(playerId, level));
}

function now() {
  return Date.now();
}

// Build a blank cert document with all defaults.
function blankCert(playerId, level) {
  return {
    playerId,
    level,
    homeQuizReviewed: false,
    homeQuizTimestamp: null,
    homeQuizCoachId: null,
    checkpoints: {},
    passed: false,
    passedTimestamp: null,
    certifiedByCoachId: null,
    certifiedByCoachEmail: null,
    partnerId: null,
    updatedAt: now(),
    createdAt: now(),
  };
}

export async function getCertification(playerId, level) {
  const snap = await getDoc(certDocRef(playerId, level));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Upsert: merges updates into existing doc or creates a new one.
// Always refreshes updatedAt.
export async function updateCertification(playerId, level, updates) {
  const ref = certDocRef(playerId, level);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : blankCert(playerId, level);

  await setDoc(ref, {
    ...existing,
    ...updates,
    playerId,
    level,
    updatedAt: now(),
    createdAt: existing.createdAt ?? now(),
  });
}

// Toggle a single checkpoint boolean.
export async function toggleCheckpoint(playerId, level, checkpointKey) {
  const ref = certDocRef(playerId, level);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : blankCert(playerId, level);

  const currentCheckpoints = existing.checkpoints || {};
  const updated = {
    ...currentCheckpoints,
    [checkpointKey]: !currentCheckpoints[checkpointKey],
  };

  await setDoc(ref, {
    ...existing,
    checkpoints: updated,
    playerId,
    level,
    updatedAt: now(),
    createdAt: existing.createdAt ?? now(),
  });
}

// Mark the home quiz as reviewed (or un-reviewed).
export async function setHomeQuizReviewed(playerId, level, reviewed) {
  const user = auth.currentUser;
  await updateCertification(playerId, level, {
    homeQuizReviewed: reviewed,
    homeQuizTimestamp: reviewed ? now() : null,
    homeQuizCoachId: reviewed ? (user?.uid ?? null) : null,
  });
}

// Mark (or unmark) a certification as passed.
// When marking passed, auto-captures current coach info and timestamp.
export async function markPassed(playerId, level, passed) {
  const user = auth.currentUser;
  await updateCertification(playerId, level, {
    passed,
    passedTimestamp: passed ? now() : null,
    certifiedByCoachId: passed ? (user?.uid ?? null) : null,
    certifiedByCoachEmail: passed ? (user?.email ?? null) : null,
  });
}

// Set the L2 partner for a player. Also updates the partner's cert with this player as their partner.
export async function setPartner(playerId, level, partnerId) {
  await updateCertification(playerId, level, { partnerId });

  if (partnerId) {
    await updateCertification(partnerId, level, { partnerId: playerId });
  }
}
