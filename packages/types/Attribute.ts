export type ENAttribute = keyof typeof attributeMap;
export type RUAttribute = typeof attributeMap[keyof typeof attributeMap];

export const attributeMap = {
  strength: 'сила',
  dexterity: "ловкость",
  constitution: "телосложение",
  intelligence: "интеллект",
  wisdom: "мудрость",
  charisma: "харизма",
} as const