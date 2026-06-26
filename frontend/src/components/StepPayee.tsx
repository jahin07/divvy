import type { Person } from '../types'
import { Card } from './ui/Card'
import { RadioCard } from './ui/RadioCard'
import { Button } from './ui/Button'
import { ErrorMessage } from './ui/ErrorMessage'

interface StepPayeeProps {
  people: Person[]
  payee: string | null
  onSelect: (name: string) => void
  error: string | null
  onBack: () => void
  onNext: () => void
}

export function StepPayee({ people, payee, onSelect, error, onBack, onNext }: StepPayeeProps) {
  return (
    <Card
      label="Step 2"
      title="Who picked up the tab?"
      description="Select the person who paid the full bill."
    >
      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <RadioCard
            key={p.name}
            name={p.name}
            selected={payee === p.name}
            onSelect={() => onSelect(p.name)}
          />
        ))}
      </div>
      <ErrorMessage message={error} />
      <div className="flex justify-between mt-7 gap-2.5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Continue
        </Button>
      </div>
    </Card>
  )
}
