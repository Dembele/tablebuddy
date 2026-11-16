export type ENSize = keyof typeof sizeMap
export type RUSize = typeof sizeMap[ENSize]

export const sizeMap = {
  tiny: 'крошечный',
  small: 'маленький',
  medium: 'средний',
  large: 'большой',
  huge: 'огромный',
  gargantuan: 'громадный'
} as const

export const sizeOffsetMap = {
  tiny: { size: 0.25, offset: 0 },     // same cell + backend enforcement
  small: { size: 1, offset: 0 },       // same cell
  medium: { size: 1, offset: 0 },      // same cell
  large: { size: 2, offset: 0.5 },     // Center at cell intersection (+0,5)
  huge: { size: 3, offset: 1 },        // Center at middle cell (+1)
  gargantuan: { size: 4, offset: 1.5 } // Center between cells (+1,5)
} as const

export type ENCreatureType = keyof typeof creatureTypeMap
export type RUCreatureType = typeof creatureTypeMap[ENCreatureType]

export const creatureTypeMap = {
  aberration: 'Аберрация',
  beast: 'Зверь',
  celestial: 'Небожитель',
  construct: 'Конструкт',
  dragon: 'Дракон',
  elemental: 'Элементаль',
  fey: 'Фея',
  fiend: 'Исчадие',
  giant: 'Великан',
  humanoid: 'Гуманоид',                                                                                                 //all PHB 2024 species
  monstrosity: 'Чудовище',
  ooze: 'Слизь',
  plant: 'Растение',
  undead: 'Нежить'
} as const