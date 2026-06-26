import type { CalculationResult } from '../types'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { ErrorMessage } from './ui/ErrorMessage'

interface StepResultsProps {
  results: CalculationResult | null
  error: string | null
  loading: boolean
  onBack: () => void
  onReset: () => void
}

export function StepResults({ results, error, loading, onBack, onReset }: StepResultsProps) {
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
      <ErrorMessage message={error} />
      <div className="flex justify-between mt-7 gap-2.5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onReset}>
          New Split
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
