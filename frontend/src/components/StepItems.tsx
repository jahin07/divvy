import { useEffect } from 'react'
import type { Person, Item } from '../types'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { ChipCheckbox } from './ui/ChipCheckbox'
import { ErrorMessage } from './ui/ErrorMessage'

interface StepItemsProps {
  people: Person[]
  items: Item[]
  onChange: (items: Item[]) => void
  error: string | null
  onBack: () => void
  onNext: () => void
}

export function StepItems({ people, items, onChange, error, onBack, onNext }: StepItemsProps) {
  const addItem = () => {
    const id = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1
    onChange([...items, { id, name: '', cost: '', participants: 'all' }])
  }

  const removeItem = (id: number) => {
    onChange(items.filter((it) => it.id !== id))
  }

  const updateItem = (id: number, updates: Partial<Item>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...updates } : it)))
  }

  const toggleParticipant = (item: Item, personName: string) => {
    if (item.participants === 'all') return
    const current = item.participants
    const updated = current.includes(personName)
      ? current.filter((n) => n !== personName)
      : [...current, personName]
    updateItem(item.id, { participants: updated })
  }

  const setMode = (item: Item, mode: 'all' | 'specific') => {
    if (mode === 'all') {
      updateItem(item.id, { participants: 'all' })
    } else {
      updateItem(item.id, { participants: people.map((p) => p.name) })
    }
  }

  // Ensure there's always at least one item row. Done in an effect (not during
  // render) so it stays a pure render and isn't double-fired by StrictMode.
  useEffect(() => {
    if (items.length === 0) {
      onChange([{ id: 1, name: '', cost: '', participants: 'all' }])
    }
    // onChange is recreated each render; the empty-guard prevents a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  if (items.length === 0) {
    return null
  }

  return (
    <Card
      label="Step 3"
      title="What was ordered?"
      description="Add each item from the receipt. Choose who shared each one."
    >
      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const isAll = item.participants === 'all'
          return (
            <div
              key={item.id}
              className="border border-border rounded-card p-5 bg-surface transition-[border-color] duration-200 hover:border-white/10"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="font-display text-base text-amber">
                  Item {index + 1}
                </span>
                <Button variant="danger" onClick={() => removeItem(item.id)} className="text-base">
                  &times;
                </Button>
              </div>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
                  Item name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Margherita Pizza"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                />
              </div>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
                  Cost
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  dollar
                  value={item.cost}
                  onChange={(e) => updateItem(item.id, { cost: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
                  Shared by
                </label>
                <div className="flex gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setMode(item, 'all')}
                    className={`px-4 py-2 border rounded-full text-sm font-semibold font-body cursor-pointer transition-all duration-200 ${
                      isAll
                        ? 'bg-amber text-bg border-amber'
                        : 'bg-transparent border-border text-text-muted hover:border-white/12 hover:text-text-secondary'
                    }`}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(item, 'specific')}
                    className={`px-4 py-2 border rounded-full text-sm font-semibold font-body cursor-pointer transition-all duration-200 ${
                      !isAll
                        ? 'bg-amber text-bg border-amber'
                        : 'bg-transparent border-border text-text-muted hover:border-white/12 hover:text-text-secondary'
                    }`}
                  >
                    Specific people
                  </button>
                </div>
                {!isAll && (
                  <div className="flex flex-wrap gap-1.5">
                    {people.map((p) => (
                      <ChipCheckbox
                        key={p.name}
                        label={p.name}
                        checked={(item.participants as string[]).includes(p.name)}
                        onChange={() => toggleParticipant(item, p.name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Button variant="add" onClick={addItem} className="mt-3">
        + Add an item
      </Button>
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
