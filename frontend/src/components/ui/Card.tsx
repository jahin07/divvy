import type { ReactNode } from 'react'

interface CardProps {
  label: string
  title: string
  description: string
  children: ReactNode
}

export function Card({ label, title, description, children }: CardProps) {
  return (
    <div className="bg-card border border-card-border rounded-card p-7 max-[480px]:p-5 backdrop-blur-[10px]">
      <div className="text-xs font-bold tracking-[0.2em] uppercase text-amber mb-1.5">
        {label}
      </div>
      <h2 className="font-display text-[1.6rem] mb-1 text-text">{title}</h2>
      <p className="text-text-secondary text-sm mb-6 leading-relaxed max-[480px]:mb-5">{description}</p>
      {children}
    </div>
  )
}
