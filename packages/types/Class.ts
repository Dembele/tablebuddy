export type ENSpellProgression = keyof typeof spellProgressionMap
export type RUSpellProgression = typeof spellProgressionMap[ENSpellProgression]

export const spellProgressionMap = {
  'full': 'полный',
  'half': 'половина',
  'third': 'треть',
  'warlock': 'чернокнижник',
  'wizard': 'волшебник'
} as const

export type ENClass = keyof typeof classMap
export type RUClass = typeof classMap[ENClass]

export const classMap = {
  barbarian: 'Варвар',
  bard: 'Бард',
  cleric: 'Жрец',
  druid: 'Друид',
  fighter: 'Воин',
  monk: 'Монах',
  paladin: 'Паладин',
  ranger: 'Следопыт',
  rogue: 'Плут',
  sorcerer: 'Чародей',
  warlock: 'Колдун',
  wizard: 'Волшебник'
} as const