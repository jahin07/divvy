import { useState } from 'react'
import type { Person, Item, CalculationResult } from '../types'

export function useCalculate() {
  const [loading, setLoading] = useState(false)

  async function calculate(
    people: Person[],
    items: Item[],
    payee: string,
    tax: number,
    tip: number,
  ): Promise<{ data?: CalculationResult; error?: string }> {
    const shares: Record<string, number> = {}
    for (const p of people) {
      shares[p.name] = p.share
    }

    const apiItems = items.map((it) => ({
      name: it.name,
      cost: parseFloat(it.cost) || 0,
      participants: it.participants,
    }))

    setLoading(true)
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares, items: apiItems, payee, tax, tip }),
      })
      const json = await res.json()
      if (!res.ok) {
        return { error: json.error || 'Server error' }
      }
      return { data: json }
    } catch {
      return { error: 'Network error. Is the server running?' }
    } finally {
      setLoading(false)
    }
  }

  return { calculate, loading }
}
