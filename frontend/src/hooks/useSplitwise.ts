import { useEffect, useState } from 'react'
import type {
  SplitwiseStatus,
  SplitwiseGroup,
  SplitwiseUser,
  CalculationResult,
} from '../types'

export function useSplitwise() {
  const [status, setStatus] = useState<SplitwiseStatus>({ configured: false })

  useEffect(() => {
    fetch('/api/splitwise/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false }))
  }, [])

  async function getGroups(): Promise<SplitwiseGroup[]> {
    const r = await fetch('/api/splitwise/groups')
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to load groups')
    return j.groups
  }

  async function getFriends(): Promise<SplitwiseUser[]> {
    const r = await fetch('/api/splitwise/friends')
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to load friends')
    return j.friends
  }

  async function pushExpense(args: {
    result: CalculationResult
    payee: string
    mapping: Record<string, number>
    groupId: number | null
    description: string
  }): Promise<{ expenseId?: number; error?: string }> {
    const r = await fetch('/api/splitwise/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const j = await r.json()
    if (!r.ok) return { error: j.error || 'Failed to push expense' }
    return { expenseId: j.expenseId }
  }

  return { status, getGroups, getFriends, pushExpense }
}
