export type ENAttackType = keyof typeof attackTypeMap;
export type RUAttackType = typeof attackTypeMap[ENAttackType];

export const attackTypeMap = {
  'melee': 'рукопашная',
  'versatile': 'усиленная',
  'thrown': 'метательная',
  'ranged': "дальнобойная",
  'spell': 'заклинание'
} as const

export type ENTargetType = keyof typeof targetTypeMap;
export type RUTargetType = typeof targetTypeMap[ENTargetType];

export const targetTypeMap = {
  "self": 'на себя',
  "single": 'цель',
  "multi": 'несколько целей',
  "point": 'точка',
  "aoe": 'радиус'
} as const

export type ENAoeType = keyof typeof aoeTypeMap;
export type RUAoeType = typeof aoeTypeMap[ENAoeType];

export const aoeTypeMap = {
  'cone': 'конус',
  'line': 'линия',
  'square': 'квадрат',
  'cube': 'куб',
  'sphere': 'сфера',
  'cylinder': 'цилиндр'
} as const