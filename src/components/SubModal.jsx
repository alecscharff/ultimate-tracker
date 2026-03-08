export default function SubModal({ isOpen, suggestedLineup, players, currentLineup, onAccept, onDismiss }) {
  if (!isOpen) return null;

  const getPlayer = id => players.find(p => p.id === id);
  const goingOut = currentLineup.filter(id => !suggestedLineup.includes(id));
  const comingIn = suggestedLineup.filter(id => !currentLineup.includes(id));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border-t border-gold w-full max-w-lg rounded-t-2xl p-5 animate-slide-up" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <h3 className="font-display text-2xl text-gold">Sub Suggestion</h3>
        </div>
        <p className="text-sm text-navy-300 mb-4">
          10 minutes have passed. Consider subbing players:
        </p>

        {goingOut.length > 0 && (
          <div className="mb-3">
            <div className="text-xs uppercase text-navy-400 mb-1 font-semibold">Coming Off</div>
            <div className="flex flex-wrap gap-2">
              {goingOut.map(id => {
                const p = getPlayer(id);
                return p ? (
                  <span key={id} className="bg-score-red/20 text-score-red px-3 py-1.5 rounded-lg text-sm font-medium">
                    {p.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {comingIn.length > 0 && (
          <div className="mb-4">
            <div className="text-xs uppercase text-navy-400 mb-1 font-semibold">Coming On</div>
            <div className="flex flex-wrap gap-2">
              {comingIn.map(id => {
                const p = getPlayer(id);
                return p ? (
                  <span key={id} className="bg-score-green/20 text-score-green px-3 py-1.5 rounded-lg text-sm font-medium">
                    {p.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onAccept} className="btn-gold flex-1">Accept Subs</button>
          <button onClick={onDismiss} className="btn-primary flex-1">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
