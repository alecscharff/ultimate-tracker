/**
 * Compute direction and pull/receive info for a given point index.
 * Direction alternates each point. Halftime adds one extra flip (teams switch ends).
 *
 * @param {number} pointIndex - 0-based index of the point
 * @param {object} gameState
 * @returns {{ direction: 'right'|'left'|null, puller: 'us'|'them'|null }}
 */
export function getPointFlipInfo(pointIndex, gameState) {
  const {
    startingDirection,
    halftimeAfterPointCount,
    flipWinner,
    flipChoice,
    points = [],
  } = gameState;

  let direction = null;
  if (startingDirection) {
    let flips = pointIndex;
    if (halftimeAfterPointCount != null && pointIndex >= halftimeAfterPointCount) {
      flips += 1;
    }
    const isRight = startingDirection === 'right' ? flips % 2 === 0 : flips % 2 !== 0;
    direction = isRight ? 'right' : 'left';
  }

  let puller = null;
  if (flipWinner && flipChoice && flipChoice !== 'endzone') {
    const firstReceiver = flipChoice === 'receive'
      ? flipWinner
      : (flipWinner === 'us' ? 'them' : 'us');
    if (pointIndex === 0) {
      puller = firstReceiver === 'us' ? 'them' : 'us';
    } else {
      const prevPoint = points[pointIndex - 1];
      if (prevPoint) {
        puller = prevPoint.scoredBy === 'us' ? 'us' : 'them';
      }
    }
  }

  return { direction, puller };
}
