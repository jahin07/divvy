# iOS Bill Split App - Design Document

## Overview

Port the existing Python bill-splitting CLI to a native iOS app using Swift + SwiftUI. Personal-use only, installed via Xcode on the developer's device.

## Requirements

- Stateless: calculate and display results, no persistence
- Single scrollable form UI
- Weighted shares support (e.g., someone paying 2x)
- Partial item participation (specific people or all)
- Proportional tax/tip distribution
- Polished visual design with custom branding

## Architecture

- Single Xcode project, one target, no external dependencies
- One main `ContentView` with a scrollable form and results section
- One pure function `computeSplit(...)` mirroring the Python logic
- State management via `@State` properties on ContentView

## Data Model

```swift
struct Person: Identifiable {
    let id: UUID
    var name: String
    var shareCount: Double  // default 1.0
}

struct LineItem: Identifiable {
    let id: UUID
    var name: String
    var cost: Double
    var participantMode: ParticipantMode  // .all or .specific([Person.ID])
}

enum ParticipantMode {
    case all
    case specific(Set<UUID>)
}

struct SplitResult {
    let payee: String
    let totalPaid: Double
    let payeeOwnShare: Double
    let netAdvanced: Double
    let breakdown: [String: PersonBreakdown]
    let debts: [String: Double]
}

struct PersonBreakdown {
    let preTax: Double
    let tax: Double
    let tip: Double
    let total: Double
}
```

## UI Layout

Single scrollable form with these sections:

1. **People** - List of name + share count rows, "Add Person" button
2. **Payee** - Picker selecting from the people list
3. **Items** - List of item rows (name, cost, participant selector), "Add Item" button
4. **Tax & Tip** - Two decimal input fields
5. **Calculate** - Button that runs computeSplit
6. **Results** - Payee summary, per-person breakdown with amounts owed

## Visual Design

- Custom accent color scheme (green/teal money theme)
- Card-style grouped sections with subtle shadows
- SF Symbols for icons (person, dollarsign, receipt)
- Custom typography hierarchy
- Light and dark mode support
- Smooth animations for adding/removing people and items

## Calculation Logic

Direct port of Python `compute_split`:

1. For "all" items: distribute cost weighted by share counts
2. For specific-participant items: split equally among named participants (ignoring share counts)
3. Tax and tip distributed proportionally based on pre-tax subtotals
4. Report: payee's total laid out, own share, net advanced, and per-person debts

## Deployment

- Personal team signing via Xcode
- Install directly to developer's iPhone via USB or Wi-Fi
