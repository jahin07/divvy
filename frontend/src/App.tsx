import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWizard } from './hooks/useWizard'
import { useCalculate } from './hooks/useCalculate'
import { ProgressRail } from './components/ProgressRail'
import { StepPeople } from './components/StepPeople'
import { StepPayee } from './components/StepPayee'
import { StepItems } from './components/StepItems'
import { StepTaxTip } from './components/StepTaxTip'
import { StepResults } from './components/StepResults'

const pageVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export default function App() {
  const [state, dispatch] = useWizard()
  const { calculate, loading } = useCalculate()
  const [splitwiseGroupId, setSplitwiseGroupId] = useState<number | null>(null)

  const goToStep = useCallback(
    async (target: number) => {
      dispatch({ type: 'CLEAR_ERROR' })

      // Validate step 1 → 2+
      if (target >= 2) {
        const { people } = state
        if (people.some((p) => !p.name.trim())) {
          dispatch({ type: 'SET_ERROR', error: 'All names must be filled in.' })
          dispatch({ type: 'SET_STEP', step: 1 })
          return
        }
        const names = people.map((p) => p.name.trim())
        if (new Set(names).size !== names.length) {
          dispatch({ type: 'SET_ERROR', error: 'Duplicate names found.' })
          dispatch({ type: 'SET_STEP', step: 1 })
          return
        }
        if (people.some((p) => isNaN(p.share) || p.share <= 0)) {
          dispatch({ type: 'SET_ERROR', error: 'All shares must be greater than 0.' })
          dispatch({ type: 'SET_STEP', step: 1 })
          return
        }
        if (people.length < 2) {
          dispatch({ type: 'SET_ERROR', error: 'Need at least 2 people.' })
          dispatch({ type: 'SET_STEP', step: 1 })
          return
        }
      }

      // Validate step 2 → 3+
      if (target >= 3) {
        const names = state.people.map((p) => p.name.trim())
        if (!state.payee || !names.includes(state.payee)) {
          dispatch({ type: 'SET_ERROR', error: 'Please select who paid.' })
          dispatch({ type: 'SET_STEP', step: 2 })
          return
        }
      }

      // Validate step 3 → 4+
      if (target >= 4) {
        const { items } = state
        if (items.length === 0) {
          dispatch({ type: 'SET_ERROR', error: 'Add at least 1 item.' })
          dispatch({ type: 'SET_STEP', step: 3 })
          return
        }
        for (const item of items) {
          if (!item.name.trim()) {
            dispatch({ type: 'SET_ERROR', error: 'All items need a name.' })
            dispatch({ type: 'SET_STEP', step: 3 })
            return
          }
          const cost = parseFloat(item.cost)
          if (isNaN(cost) || cost < 0) {
            dispatch({ type: 'SET_ERROR', error: `Invalid cost for "${item.name}".` })
            dispatch({ type: 'SET_STEP', step: 3 })
            return
          }
          if (item.participants !== 'all' && item.participants.length === 0) {
            dispatch({
              type: 'SET_ERROR',
              error: `"${item.name}" needs at least 1 participant.`,
            })
            dispatch({ type: 'SET_STEP', step: 3 })
            return
          }
        }
      }

      // Validate step 4 → 5
      if (target === 5) {
        const tax = parseFloat(state.tax) || 0
        const tip = parseFloat(state.tip) || 0
        if (tax < 0 || tip < 0) {
          dispatch({ type: 'SET_ERROR', error: 'Values cannot be negative.' })
          dispatch({ type: 'SET_STEP', step: 4 })
          return
        }
        dispatch({ type: 'SET_STEP', step: 5 })
        const result = await calculate(state.people, state.items, state.payee!, tax, tip)
        if (result.error) {
          dispatch({ type: 'SET_ERROR', error: result.error })
        } else if (result.data) {
          dispatch({ type: 'SET_RESULTS', results: result.data })
        }
        return
      }

      dispatch({ type: 'SET_STEP', step: target })
    },
    [state, dispatch, calculate],
  )

  const handleReset = () => {
    dispatch({ type: 'RESET' })
  }

  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden">
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      {/* Frosted bar behind the device status bar (notch / time / battery) so
          page content scrolling underneath stays legible instead of clashing. */}
      <div className="safe-area-blur" />

      <div className="app-shell mx-auto w-full max-w-md px-5 pb-10 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-[2.5rem] tracking-[-0.02em] bg-gradient-to-br from-amber to-[#f0c96e] bg-clip-text text-transparent mb-1 max-[480px]:text-[2rem]">
            Divvy
          </h1>
          <p className="text-text-muted text-sm font-medium tracking-[0.15em] uppercase">
            Split bills beautifully
          </p>
        </div>

        <ProgressRail current={state.step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {state.step === 1 && (
              <StepPeople
                title={state.title}
                onTitleChange={(title) => dispatch({ type: 'SET_TITLE', title })}
                people={state.people}
                onChange={(people) => dispatch({ type: 'SET_PEOPLE', people })}
                error={state.error}
                onNext={() => goToStep(2)}
                onGroupIdChange={setSplitwiseGroupId}
              />
            )}
            {state.step === 2 && (
              <StepPayee
                people={state.people}
                payee={state.payee}
                onSelect={(payee) => dispatch({ type: 'SET_PAYEE', payee })}
                error={state.error}
                onBack={() => goToStep(1)}
                onNext={() => goToStep(3)}
              />
            )}
            {state.step === 3 && (
              <StepItems
                people={state.people}
                items={state.items}
                onChange={(items) => dispatch({ type: 'SET_ITEMS', items })}
                error={state.error}
                onBack={() => goToStep(2)}
                onNext={() => goToStep(4)}
                onScanTaxTip={(tax, tip) => dispatch({ type: 'SET_TAX_TIP', tax, tip })}
              />
            )}
            {state.step === 4 && (
              <StepTaxTip
                tax={state.tax}
                tip={state.tip}
                onChangeTax={(v) => dispatch({ type: 'SET_TAX_TIP', tax: v, tip: state.tip })}
                onChangeTip={(v) => dispatch({ type: 'SET_TAX_TIP', tax: state.tax, tip: v })}
                error={state.error}
                onBack={() => goToStep(3)}
                onNext={() => goToStep(5)}
              />
            )}
            {state.step === 5 && (
              <StepResults
                results={state.results}
                error={state.error}
                loading={loading}
                onBack={() => goToStep(4)}
                onReset={handleReset}
                people={state.people}
                payee={state.payee!}
                groupId={splitwiseGroupId}
                title={state.title}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
