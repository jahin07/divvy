import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { ErrorMessage } from './ui/ErrorMessage'

interface StepTaxTipProps {
  tax: string
  tip: string
  onChangeTax: (v: string) => void
  onChangeTip: (v: string) => void
  error: string | null
  onBack: () => void
  onNext: () => void
}

export function StepTaxTip({ tax, tip, onChangeTax, onChangeTip, error, onBack, onNext }: StepTaxTipProps) {
  return (
    <Card
      label="Step 4"
      title="Tax & Tip"
      description="These are split proportionally based on each person's share of the bill."
    >
      <div className="mb-4">
        <label className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
          Tax amount
        </label>
        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="0.00"
          dollar
          value={tax}
          onChange={(e) => onChangeTax(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
          Tip amount
        </label>
        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="0.00"
          dollar
          value={tip}
          onChange={(e) => onChangeTip(e.target.value)}
        />
      </div>
      <ErrorMessage message={error} />
      <div className="flex justify-between mt-7 gap-2.5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Calculate Split
        </Button>
      </div>
    </Card>
  )
}
