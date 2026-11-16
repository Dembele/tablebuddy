export type SpellLevel = typeof spellLevels[number]
export type ENSpellSchool = keyof typeof spellSchoolMap
export type RUSpellSchool = typeof spellSchoolMap[keyof typeof spellSchoolMap]


export const spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const //plus special case: 0 - cantrip

export const spellSchoolMap = {
  abjuration: 'Ограждение',
  conjuration: 'Вызов',
  divination: 'Прорицание',
  enchantment: 'Очарование',
  evocation: 'Воплощение',
  illusion: 'Иллюзия',
  necromancy: 'Некромантия',
  transmutation: 'Преобразование'
} as const