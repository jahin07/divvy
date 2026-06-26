import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  dollar?: boolean
}

export function Input({ dollar, className = '', ...props }: InputProps) {
  if (dollar) {
    return (
      <div className="flex items-center border border-border rounded-input bg-surface transition-[border-color,box-shadow] duration-200 focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_var(--color-amber-dim)]">
        <span className="pl-3.5 pr-1 text-text-muted font-semibold text-sm shrink-0 select-none">
          $
        </span>
        <input
          className={`w-full pr-3.5 py-3 text-sm font-body font-medium text-text bg-transparent outline-none placeholder:text-text-muted ${className}`}
          {...props}
        />
      </div>
    )
  }

  return (
    <input
      className={`w-full pl-3.5 pr-3.5 py-3 border border-border rounded-input text-sm font-body font-medium text-text bg-surface outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-text-muted focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-amber-dim)] ${className}`}
      {...props}
    />
  )
}
