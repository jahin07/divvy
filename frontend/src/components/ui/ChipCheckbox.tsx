interface ChipCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ChipCheckbox({ label, checked, onChange }: ChipCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`text-sm font-medium px-3.5 py-1.5 border rounded-full cursor-pointer transition-all duration-200 select-none ${
        checked
          ? 'bg-amber-dim border-amber text-amber'
          : 'border-border text-text-secondary hover:border-white/12'
      }`}
    >
      {label}
    </button>
  )
}
