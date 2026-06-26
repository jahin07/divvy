export interface Person {
  name: string
  share: number
  splitwiseId?: number
}

export interface SplitwiseUser {
  id: number
  name: string
}

export interface SplitwiseGroup {
  id: number
  name: string
  members: SplitwiseUser[]
}

export interface SplitwiseStatus {
  configured: boolean
  user?: { id: number; first_name?: string }
}

export interface Item {
  id: number
  name: string
  cost: string
  participants: 'all' | string[]
}

export interface BreakdownEntry {
  pre_tax: number
  tax: number
  tip: number
  total: number
}

export interface CalculationResult {
  payee: string
  total_paid: number
  payee_own_share: number
  net_advanced: number
  breakdown: Record<string, BreakdownEntry>
  debts: Record<string, number>
}

export interface WizardState {
  step: number
  people: Person[]
  payee: string | null
  items: Item[]
  tax: string
  tip: string
  results: CalculationResult | null
  error: string | null
}

export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_PEOPLE'; people: Person[] }
  | { type: 'SET_PAYEE'; payee: string }
  | { type: 'SET_ITEMS'; items: Item[] }
  | { type: 'SET_TAX_TIP'; tax: string; tip: string }
  | { type: 'SET_RESULTS'; results: CalculationResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' }
