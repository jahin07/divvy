interface RadioCardProps {
  name: string
  selected: boolean
  onSelect: () => void
}

export function RadioCard({ name, selected, onSelect }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3.5 px-4 py-3.5 border rounded-input cursor-pointer transition-all duration-200 relative overflow-hidden text-left w-full ${
        selected
          ? 'border-amber shadow-[0_0_0_1px_var(--color-amber)]'
          : 'border-border hover:border-white/12'
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br from-amber-dim to-transparent transition-opacity duration-200 ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span
        className={`relative z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          selected ? 'border-amber' : 'border-text-muted'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full bg-amber transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            selected ? 'scale-100' : 'scale-0'
          }`}
        />
      </span>
      <span className="relative z-10 font-semibold text-base">{name}</span>
    </button>
  )
}
