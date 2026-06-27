import { useState } from 'react'
import type { CalculationResult, Person } from '../types'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { ErrorMessage } from './ui/ErrorMessage'
import { useSplitwise } from '../hooks/useSplitwise'

interface StepResultsProps {
  results: CalculationResult | null
  error: string | null
  loading: boolean
  onBack: () => void
  onReset: () => void
  people: Person[]
  payee: string
  groupId: number | null
  title: string
}

export function StepResults({ results, error, loading, onBack, onReset, people, payee, groupId, title }: StepResultsProps) {
  const { status, pushExpense } = useSplitwise()
  const [pushing, setPushing] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState<{ expenseId?: number } | null>(null)

  const canPush =
    results != null && people.length > 0 && people.every((p) => p.splitwiseId != null)

  const handlePush = async () => {
    if (!results || !canPush) return
    setPushing(true)
    setPushError(null)
    setPushSuccess(null)
    const mapping = Object.fromEntries(
      people.filter((p) => p.splitwiseId != null).map((p) => [p.name, p.splitwiseId!]),
    )
    const description = title.trim() || `Divvy split — ${new Date().toLocaleDateString()}`
    try {
      const res = await pushExpense({ result: results, payee, mapping, groupId, description })
      if (res.error) {
        setPushError(res.error)
      } else {
        setPushSuccess({ expenseId: res.expenseId })
      }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setPushing(false)
    }
  }

  return (
    <Card label="Results" title="Here's the breakdown" description="Everyone's share, calculated fairly.">
      {loading && <p className="text-text-muted text-center py-8">Calculating...</p>}
      {results && !loading && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2.5 mb-7 max-[480px]:grid-cols-1">
            <StatCard value={results.total_paid} label="Total Bill" />
            <StatCard value={results.payee_own_share} label={`${results.payee}'s Share`} />
            <StatCard value={results.net_advanced} label="Covered" />
          </div>

          {/* Breakdown table */}
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-text-muted mb-3 pb-2 border-b border-border">
            Full Breakdown
          </div>
          <table className="w-full border-collapse mb-7 text-sm">
            <thead>
              <tr>
                {['Person', 'Subtotal', 'Tax', 'Tip', 'Total'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-2.5 py-2 text-xs font-bold tracking-[0.1em] uppercase text-text-muted border-b border-border"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(results.breakdown).map(([name, b]) => (
                <tr key={name} className="border-b border-white/4 last:border-b-0">
                  <td className="px-2.5 py-2.5 text-text font-semibold">{name}</td>
                  <td className="px-2.5 py-2.5 text-text-secondary">${b.pre_tax.toFixed(2)}</td>
                  <td className="px-2.5 py-2.5 text-text-secondary">${b.tax.toFixed(2)}</td>
                  <td className="px-2.5 py-2.5 text-text-secondary">${b.tip.toFixed(2)}</td>
                  <td className="px-2.5 py-2.5 text-amber font-bold">${b.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Debts */}
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-text-muted mb-3 pb-2 border-b border-border">
            Who Owes {results.payee}
          </div>
          <ul className="list-none">
            {Object.keys(results.debts).length === 0 ? (
              <li className="text-center py-5 text-text-muted italic">Everyone's settled up!</li>
            ) : (
              Object.entries(results.debts).map(([name, amt]) => (
                <li
                  key={name}
                  className="flex justify-between items-center px-4 py-3.5 mb-2 bg-surface border border-border rounded-input transition-all duration-200 hover:border-white/10 hover:translate-x-1 last:mb-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm">{name}</span>
                    <span className="text-text-muted text-xs">owes</span>
                    <span className="text-text-secondary text-sm font-medium">
                      {results.payee}
                    </span>
                  </div>
                  <span className="font-display text-lg text-amber ml-auto pl-4">
                    ${amt.toFixed(2)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
      {status.configured && results && !loading && (
        <div className="mt-6 pt-6 border-t border-border">
          {pushSuccess ? (
            <p className="text-sm font-medium text-center text-green py-2 px-3 bg-green-dim rounded-input">
              Added to Splitwise ✓
              {pushSuccess.expenseId != null ? ` (expense #${pushSuccess.expenseId})` : ''}
            </p>
          ) : (
            <>
              <ErrorMessage message={pushError} />
              <div className="flex flex-col gap-2 mt-2">
                <Button
                  variant="primary"
                  onClick={() => void handlePush()}
                  disabled={!canPush || pushing}
                  className="w-full py-3.5 text-base rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pushing ? 'Adding…' : 'Push to Splitwise'}
                </Button>
                {!canPush && (
                  <p className="text-xs text-text-muted text-center">
                    Import people from Splitwise to enable
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <ErrorMessage message={error} />
      <div className="flex justify-between mt-7 gap-2.5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="ghost"
          onClick={onReset}
          className="border-amber/40 text-amber font-semibold hover:bg-amber-dim hover:border-amber hover:text-amber"
        >
          + New Split
        </Button>
      </div>
    </Card>
  )
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center py-5 px-2.5 bg-surface border border-border rounded-input transition-[border-color] duration-200 hover:border-white/12">
      <div className="font-display text-[1.4rem] text-amber mb-0.5">
        ${value.toFixed(2)}
      </div>
      <div className="text-xs font-semibold tracking-[0.1em] uppercase text-text-muted">
        {label}
      </div>
    </div>
  )
}
