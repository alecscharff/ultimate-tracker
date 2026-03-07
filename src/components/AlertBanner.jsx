export default function AlertBanner({ type, message, onAction, actionLabel }) {
  const styles = {
    warning: 'bg-gold/20 border-gold/40 text-gold',
    danger: 'bg-score-red/20 border-score-red/40 text-score-red',
    info: 'bg-navy-600/30 border-navy-500/40 text-navy-300',
  };

  return (
    <div className={`${styles[type] || styles.info} border-b px-4 py-2.5 flex items-center justify-between gap-3`}>
      <span className="text-sm font-semibold flex items-center gap-2">
        {type === 'danger' && <span className="animate-pulse">!</span>}
        {type === 'warning' && <span className="animate-pulse">!</span>}
        {message}
      </span>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg bg-white/10 active:bg-white/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
