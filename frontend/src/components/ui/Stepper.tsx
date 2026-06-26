interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function Stepper({ value, onChange, min = 1, max = 10, step = 1 }: StepperProps) {
  const atMin = value <= min
  const atMax = value >= max

  const decrement = () => {
    if (!atMin) onChange(Math.round((value - step) * 10) / 10)
  }

  const increment = () => {
    if (!atMax) onChange(Math.round((value + step) * 10) / 10)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={decrement}
        disabled={atMin}
        className={`w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-sm cursor-pointer transition-all duration-200 ${
          atMin ? 'opacity-40 cursor-not-allowed' : 'hover:border-amber hover:text-amber'
        }`}
      >
        −
      </button>
      <span className="font-display text-amber text-sm min-w-[2rem] text-center tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={atMax}
        className={`w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-sm cursor-pointer transition-all duration-200 ${
          atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-amber hover:text-amber'
        }`}
      >
        +
      </button>
    </div>
  )
}
