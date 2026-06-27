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

  const [importOpen, setImportOpen] = useState(false)
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
  // Friends already added, pinned regardless of the search box (which clears
  // after each pick). Search results exclude these so they aren't shown twice.
  const pickedFriends = friends.filter((f) => selectedFriendIds.has(f.id))
  const unpickedMatches = visibleFriends.filter((f) => !selectedFriendIds.has(f.id))

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
    if (!status.configured || !importOpen) return
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
  }, [importMode, status.configured, importOpen, groupsLoaded, friendsLoaded])

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
    // Clear the search box after a pick so the next friend can be typed
    // without having to backspace the previous query first.
    setFriendSearch('')
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
      description="Add the people who are paying and their shares. Adjust share weight for anyone covering a larger portion of shared items."
    >
      <div className="mb-7">
        <label className="block text-xs font-bold tracking-[0.12em] uppercase text-text-secondary mb-2.5">
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
        <div className="mb-7">
          <button
            type="button"
            onClick={() => setImportOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-input bg-surface text-left transition-colors duration-200 hover:border-white/12"
          >
            <span className="text-xs font-bold tracking-[0.15em] uppercase text-amber">
              Import from Splitwise
            </span>
            <svg
              className={`w-4 h-4 text-text-muted transition-transform duration-200 ${importOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {importOpen && (
            <div className="mt-2 border border-border rounded-input p-4 bg-surface">
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
                  {/* Already-added friends stay pinned here so you keep a running
                      list and can tap to remove someone, even though the search
                      box clears after every pick. */}
                  {pickedFriends.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {pickedFriends.map((f) => (
                        <ChipCheckbox
                          key={f.id}
                          label={f.name}
                          checked
                          onChange={() => toggleFriend(f)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Matches for the current query that haven't been added yet. */}
                  {friendSearch.trim() && unpickedMatches.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {unpickedMatches.map((f) => (
                        <ChipCheckbox
                          key={f.id}
                          label={f.name}
                          checked={false}
                          onChange={() => toggleFriend(f)}
                        />
                      ))}
                    </div>
                  )}
                  {friendSearch.trim() && visibleFriends.length === 0 && (
                    <p className="text-text-muted text-sm mt-2">No friends match “{friendSearch}”.</p>
                  )}
                </>
              )}
            </>
          )}
            </div>
          )}
        </div>
      )}

      <label className="block text-xs font-bold tracking-[0.12em] uppercase text-text-secondary mb-3.5">
        People
      </label>
      <div className="flex flex-col gap-3">
        {people.map((person, i) => (
          <div key={i} className="flex gap-2.5 items-center">
            <div className="w-9 h-9 rounded-full bg-amber-dim text-amber flex items-center justify-center text-sm font-bold flex-shrink-0 uppercase select-none">
              {person.name.trim().charAt(0) || '?'}
            </div>
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
      <Button variant="add" onClick={addPerson} className="mt-4">
        + Add another person
      </Button>
      <ErrorMessage message={error} />
      <Button
        variant="primary"
        onClick={onNext}
        className="w-full mt-8 py-3.5 text-base rounded-full"
      >
        Continue
      </Button>
    </Card>
  )
}
