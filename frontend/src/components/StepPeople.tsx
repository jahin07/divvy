import type { Person } from '../types'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Stepper } from './ui/Stepper'
import { ErrorMessage } from './ui/ErrorMessage'

interface StepPeopleProps {
  people: Person[]
  onChange: (people: Person[]) => void
  error: string | null
  onNext: () => void
}

export function StepPeople({ people, onChange, error, onNext }: StepPeopleProps) {
  const updatePerson = (index: number, field: keyof Person, value: string | number) => {
    const updated = people.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    onChange(updated)
  }

  const addPerson = () => {
    onChange([...people, { name: '', share: 1 }])
  }

  const removePerson = (index: number) => {
    if (people.length <= 2) return
    onChange(people.filter((_, i) => i !== index))
  }

  return (
    <Card
      label="Step 1"
      title="Who's splitting?"
      description="Add everyone at the table. Adjust share weight for anyone paying a larger portion of shared items."
    >
      <div className="flex flex-col gap-3">
        {people.map((person, i) => (
          <div key={i} className="flex gap-4 items-center">
            <Input
              type="text"
              placeholder="Name"
              value={person.name}
              onChange={(e) => updatePerson(i, 'name', e.target.value)}
              className="flex-[2]"
              autoFocus={i === 0}
            />
            <Stepper
              value={person.share}
              onChange={(v) => updatePerson(i, 'share', v)}
            />
            <Button
              variant="danger"
              onClick={() => removePerson(i)}
              disabled={people.length <= 2}
              className="text-base"
            >
              &times;
            </Button>
          </div>
        ))}
      </div>
      <Button variant="add" onClick={addPerson} className="mt-3">
        + Add another person
      </Button>
      <ErrorMessage message={error} />
      <div className="flex justify-between mt-7 gap-2.5">
        <span />
        <Button variant="primary" onClick={onNext}>
          Continue
        </Button>
      </div>
    </Card>
  )
}
