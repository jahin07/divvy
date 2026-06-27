import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'add' | 'addProminent'

const variants: Record<Variant, string> = {
  primary:
    'gap-1.5 px-6 py-3 rounded-input text-sm font-semibold bg-amber text-bg hover:bg-[#f0b340] hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-amber-glow)] active:translate-y-0',
  ghost:
    'gap-1.5 px-6 py-3 rounded-input text-sm font-semibold bg-transparent border border-border text-text-secondary hover:bg-surface-hover hover:border-white/12 hover:text-text',
  danger:
    'w-8 h-8 p-0 rounded-input bg-red-dim text-red hover:bg-[rgba(248,113,113,0.25)] flex-shrink-0',
  add:
    'w-full gap-1.5 px-5 py-2.5 rounded-input border border-dashed border-border bg-transparent text-text-muted text-sm hover:border-amber hover:text-amber hover:bg-amber-dim',
  addProminent:
    'w-full gap-2 px-5 py-3 rounded-input border border-amber/60 bg-amber-dim text-amber text-sm font-semibold hover:bg-[rgba(232,168,56,0.22)] hover:border-amber hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-amber-glow)] active:translate-y-0',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center border-none cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] font-body ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
