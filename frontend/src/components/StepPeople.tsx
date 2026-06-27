import { useState, useEffect, type ChangeEvent } from 'react'
import type { Person, SplitwiseGroup, SplitwiseUser } from '../types'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Stepper } from './ui/Stepper'
import { ErrorMessage } from './ui/ErrorMessage'
import { RadioCard } from './ui/RadioCard'
import { ChipCheckbox } from './ui/ChipCheckbox'
import { useSplitwise } from '../hooks/useSplitwise'

interface StepPeopleProps {
  title: string
  onTitleChange: (title: string) => void
  people: Person[]
  onChange: (people: Person[]) => void
  error: string | null
  onNext: () => void
  onGroupIdChange: (id: number | null) => void
}

export function StepPeople({ title, onTitleChange, people, onChange, error, onNext, onGroupIdChange }: StepPeopleProps) {
  const { status, getGroups, getFriends } = useSplitwise()

  const [importMode, setImportMode] = useState<'group' | 'friends'>('group')
  const [groups, setGroups] = useState<SplitwiseGroup[]>([])
  const [friends, setFriends] = useState<SplitwiseUser[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<number>>(new Set())
  const [groupSearch, setGroupSearch] = useState('')
  const [friendSearch, setFriendSearch] = useState('')

  const visibleGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()),
  )
  const visibleFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(friendSearch.trim().toLowerCase()),
  )

  // The current Splitwise user. The friends endpoint never returns yourself, so
  // include "me" automatically in friends-based splits (you're virtually always
  // part of a bill you're splitting, and usually the payer).
  const me: SplitwiseUser | null =
    status.configured && status.user
      ? { id: status.user.id, name: status.user.first_name || 'You' }
      : null

  useEffect(() => {
    setImportError(null)
  }, [importMode])

  useEffect(() => {
    if (!status.configured) return
    if (importMode === 'group' && !groupsLoaded) {
      setImportLoading(true)
      setImportError(null)
      getGroups()
        .then((g) => {
          setGroups(g)
          setGroupsLoaded(true)
        })
        .catch((e) => setImportError(e instanceof Error ? e.message : 'Failed to load groups'))
        .finally(() => setImportLoading(false))
    } else if (importMode === 'friends' && !friendsLoaded) {
      setImportLoading(true)
      setImportError(null)
      getFriends()
        .then((f) => {
          setFriends(f)
          setFriendsLoaded(true)
        })
        .catch((e) => setImportError(e instanceof Error ? e.message : 'Failed to load friends'))
        .finally(() => setImportLoading(false))
    }
    // getGroups and getFriends are stable fetch wrappers; intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importMode, status.configured, groupsLoaded, friendsLoaded])

  const handleGroupSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedGroupId(val)
    const id = parseInt(val, 10)
    if (isNaN(id)) {
      onGroupIdChange(null)
      return
    }
    const group = groups.find((g) => g.id === id)
    if (!group) return
    const newPeople: Person[] = group.members.map((m) => ({
      name: m.name,
      share: 1,
      splitwiseId: m.id,
    }))
    onChange(newPeople)
    onGroupIdChange(id)
  }

  const toggleFriend = (friend: SplitwiseUser) => {
    const next = new Set(selectedFriendIds)
    if (next.has(friend.id)) {
      next.delete(friend.id)
    } else {
      next.add(friend.id)
    }
    setSelectedFriendIds(next)
    const selectedFriends: Person[] = friends
      .filter((f) => next.has(f.id))
      .map((f) => ({ name: f.name, share: 1, splitwiseId: f.id }))
    const newPeople: Person[] = me
      ? [{ name: me.name, share: 1, splitwiseId: me.id }, ...selectedFriends]
      : selectedFriends
    onChange(newPeople)
    onGroupIdChange(null)
  }

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
      <div className="mb-6">
        <label className="block text-xs font-bold tracking-[0.15em] uppercase text-text-muted mb-2">
          Bill title
        </label>
        <Input
          type="text"
          placeholder="e.g. Dinner at Luigi's"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      {status.configured && (
        <div className="mb-6 border border-border rounded-input p-4 bg-surface">
          <p className="text-xs font-bold tracking-[0.15em] uppercase text-amber mb-3">
            Import from Splitwise
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <RadioCard
              name="Group"
              selected={importMode === 'group'}
              onSelect={() => {
                setImportMode('group')
                if (selectedGroupId) onGroupIdChange(parseInt(selectedGroupId, 10))
              }}
            />
            <RadioCard
              name="Friends"
              selected={importMode === 'friends'}
              onSelect={() => { setImportMode('friends'); onGroupIdChange(null) }}
            />
          </div>

          {importLoading && (
            <p className="text-text-muted text-sm text-center py-2">Loading…</p>
          )}

          <ErrorMessage message={importError} />

          {!importLoading && !importError && importMode === 'group' && (
            <>
              {groupsLoaded && groups.length === 0 ? (
                <p className="text-text-muted text-sm">No groups found.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    type="text"
                    placeholder="Search groups…"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                  <select
                    value={selectedGroupId}
                    onChange={handleGroupSelect}
                    className="w-full pl-3.5 pr-3.5 py-3 border border-border rounded-input text-sm font-medium text-text bg-surface outline-none transition-[border-color,box-shadow] duration-200 focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-amber-dim)]"
                  >
                    <option value="">Select a group…</option>
                    {visibleGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  {groupSearch.trim() && visibleGroups.length === 0 && (
                    <p className="text-text-muted text-sm">No groups match “{groupSearch}”.</p>
                  )}
                </div>
              )}
            </>
          )}

          {!importLoading && !importError && importMode === 'friends' && (
            <>
              {friendsLoaded && friends.length === 0 ? (
                <p className="text-text-muted text-sm">No friends found.</p>
              ) : (
                <>
                  {me && (
                    <p className="text-text-muted text-xs mb-2">
                      {me.name} (you) is included automatically.
                    </p>
                  )}
                  <Input
                    type="text"
                    placeholder="Search friends to add…"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                  />
                  {friendSearch.trim() &&
                    (visibleFriends.length === 0 ? (
                      <p className="text-text-muted text-sm mt-2">No friends match “{friendSearch}”.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {visibleFriends.map((f) => (
                          <ChipCheckbox
                            key={f.id}
                            label={f.name}
                            checked={selectedFriendIds.has(f.id)}
                            onChange={() => toggleFriend(f)}
                          />
                        ))}
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {people.map((person, i) => (
          <div key={i} className="flex gap-2.5 items-center">
            <Input
              type="text"
              placeholder="Name"
              value={person.name}
              onChange={(e) => updatePerson(i, 'name', e.target.value)}
              className="flex-[2] min-w-0"
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
