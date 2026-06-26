const STEPS = [1, 2, 3, 4, 5]

interface ProgressRailProps {
  current: number
}

export function ProgressRail({ current }: ProgressRailProps) {
  return (
    <div className="flex items-center mb-9 px-2">
      {STEPS.map((s, i) => (
        <div key={s} className="contents">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 relative z-10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              s === current
                ? 'border-amber text-bg bg-amber shadow-[0_0_20px_var(--color-amber-glow)]'
                : s < current
                  ? 'border-amber text-amber bg-amber-dim'
                  : 'border-border text-text-muted bg-surface'
            }`}
          >
            {s < current ? '✓' : s}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 transition-colors duration-300 ${
                s < current ? 'bg-amber' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
