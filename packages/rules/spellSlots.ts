//Spell slot tables (2024). Pure lookups — slot max is human-committed via the sheet.

import {ENSpellProgression} from "../types/Class"

//Pact Magic slots a warlock adds at this slot level (multiclass slot math).
function getPactContribution(slotLevel: number, warlock: number): number {
  if (warlock < 1) return 0
  const pactLevel = Math.min(Math.floor((warlock + 1) / 2), 5)
  if (pactLevel !== slotLevel) return 0

  if (warlock === 1) return 1
  if (slotLevel < 5) return 2
  if (warlock <= 8) return 0
  if (warlock <= 10) return 2
  if (warlock <= 16) return 3
  return 4
}

//Full-caster slots of one level at an effective caster level.
function getBaseSlots(slotLevel: number, effective: number): number {
  effective = Math.min(effective, 20)
  let slots = 0

  switch (slotLevel) {
    case 1:
      if (effective >= 1) slots += 2
      if (effective >= 2) slots += 1
      if (effective >= 3) slots += 1
      break
    case 2:
      if (effective >= 3) slots += 2
      if (effective >= 4) slots += 1
      break
    case 3:
      if (effective >= 5) slots += 2
      if (effective >= 6) slots += 1
      break
    case 4:
      if (effective >= 7) slots += 1
      if (effective >= 8) slots += 1
      if (effective >= 9) slots += 1
      break
    case 5:
      if (effective >= 9) slots += 1
      if (effective >= 10) slots += 1
      if (effective >= 18) slots += 1
      break
    case 6:
      if (effective >= 11) slots += 1
      if (effective >= 19) slots += 1
      break
    case 7:
      if (effective >= 13) slots += 1
      if (effective === 20) slots += 1
      break
    case 8:
      if (effective >= 15) slots += 1
      break
    case 9:
      if (effective >= 17) slots += 1
      break
  }
  return slots
}

//Total slots of one level: shared caster table + warlock pact slots.
export function fullSlots(slotLevel: number, effective: number, warlock = 0): number {
  return getBaseSlots(slotLevel, effective) + getPactContribution(slotLevel, warlock)
}

//Per-character-level slot rows (20 × 9) for a single-class progression.
export function slotsTable(progression: ENSpellProgression): number[][] {
  const fullCaster: number[][] = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
  ]

  const pad9 = (row: number[]): number[] => [
    ...row.slice(0, 9),
    ...Array(Math.max(0, 9 - row.length)).fill(0),
  ]

  const levelsPerCasterLevel: Partial<Record<ENSpellProgression, number>> = {
    full: 1,
    wizard: 1,
    half: 2,
    third: 3,
  }

  //Pact Magic: [slots, slotLevel] per character level
  const warlock: [number, number][] = [
    [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4],
    [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
  ]

  if (progression === "warlock") {
    return warlock.map(([slots, slotLevel]) => {
      const row = Array(9).fill(0)
      row[slotLevel - 1] = slots
      return row
    })
  }

  //2024 partial casters round the caster level UP (Eldritch Knight 4 = full caster 2); full casters are unaffected
  const divisor = levelsPerCasterLevel[progression] ?? 1
  return Array.from({length: 20}, (_, levelIndex) => {
    const effective = Math.ceil((levelIndex + 1) / divisor)
    return pad9(effective === 0 ? [] : fullCaster[effective - 1])
  })
}
