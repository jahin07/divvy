import { useReducer } from 'react'
import type { WizardState, WizardAction } from '../types'

const initialState: WizardState = {
  step: 1,
  title: '',
  people: [
    { name: '', share: 1 },
    { name: '', share: 1 },
  ],
  payee: null,
  items: [],
  tax: '',
  tip: '',
  results: null,
  error: null,
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null }
    case 'SET_TITLE':
      return { ...state, title: action.title }
    case 'SET_PEOPLE':
      return { ...state, people: action.people }
    case 'SET_PAYEE':
      return { ...state, payee: action.payee }
    case 'SET_ITEMS':
      return { ...state, items: action.items }
    case 'SET_TAX_TIP':
      return { ...state, tax: action.tax, tip: action.tip }
    case 'SET_RESULTS':
      return { ...state, results: action.results }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'RESET':
      return { ...initialState, people: [{ name: '', share: 1 }, { name: '', share: 1 }] }
  }
}

export function useWizard() {
  return useReducer(reducer, initialState)
}
