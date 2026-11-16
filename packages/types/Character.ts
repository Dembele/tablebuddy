export type HitDice = '4' | '6' | '8' | '10' | '12'

export const hitDiceArray: HitDice[] = ['4', '6', '8', '10', '12']

export type ENLanguage = keyof typeof languageMap
export type RULanguage = typeof languageMap[keyof typeof languageMap]

export type ENActionType = keyof typeof actionTypeMap
export type RUActionType = typeof actionTypeMap[keyof typeof actionTypeMap]

export type ENSpeedType = keyof typeof speedTypeMap
export type RUSpeedType = typeof speedTypeMap[keyof typeof speedTypeMap]

export type AttributeMethod = typeof attributeMethodMap[number]
export const attributeMethodMap = ["Распределение", "Покупка", "Бросок костей"] as const

export const XPTableMap: Record<number, number> = {
  1: 300,
  2: 900,
  3: 2700,
  4: 6500,
  5: 14000,
  6: 23000,
  7: 34000,
  8: 48000,
  9: 64000,
  10: 85000,
  11: 100000,
  12: 120000,
  13: 140000,
  14: 165000,
  15: 195000,
  16: 225000,
  17: 265000,
  18: 305000,
  19: 355000,
};

export const actionTypeMap = {
  action: 'действие',
  bonus: 'бонусное действие',
  reaction: 'реакция',
  free: 'свободно',
  passive: 'пассивно'
} as const

export const languageMap = {
  //common
  common: 'Общий',
  commonSignLanguage: 'Общий жестовый',
  draconic: 'Драконий',
  dwarvish: 'Дварфийский',
  elvish: 'Эльфийский',
  giant: 'Великаний',
  gnomish: 'Гномий',
  goblin: 'Гоблинский',
  halfling: 'Язык полуросликов',
  orc: 'Орочий',

  //rare
  abyssal: 'Язык Бездны',
  celestial: 'Небесный',
  deepSpeech: 'Глубинная речь',
  infernal: 'Инфернальный',
  primordial: 'Первичный',
  sylvan: 'Сильван',
  undercommon: 'Подземный',

  //mostly class
  druidic: 'Друидический',
  thievesCant: 'Воровской жаргон',
} as const

export const speedTypeMap = {
  walk: 'ходьбы',
  swim: 'плавания',
  fly: 'полета',
  climb: 'лазания'
} as const
