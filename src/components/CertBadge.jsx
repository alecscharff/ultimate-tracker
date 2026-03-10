// Small inline badge showing certification status for a given level.
// status: 'none' | 'in-progress' | 'passed'

export default function CertBadge({ level, status }) {
  const base =
    'inline-flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold leading-none select-none';

  if (status === 'passed') {
    return (
      <span
        className={`${base} border-score-green text-score-green bg-score-green/10`}
        title={`L${level} Certified`}
      >
        {/* checkmark */}
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
          <path
            d="M1 4l3 3 5-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (status === 'in-progress') {
    return (
      <span
        className={`${base} border-gold text-gold bg-gold/10`}
        title={`L${level} In Progress`}
      >
        L{level}
      </span>
    );
  }

  // 'none'
  return (
    <span
      className={`${base} border-navy-600 text-navy-500`}
      title={`L${level} Not Started`}
    >
      L{level}
    </span>
  );
}
