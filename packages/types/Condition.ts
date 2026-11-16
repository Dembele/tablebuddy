export type ENCondition = keyof typeof conditionMap
export type RUCondition = typeof conditionMap[ENCondition]

export const conditionMap = {
  "blinded": "Ослеплён",
  "charmed": "Очарован",
  "deafened": "Оглох",
  "exhaustion": "Истощение",
  "frightened": "Испуган",
  "grappled": "Схвачен",
  "incapacitated": "Недееспособен",
  "invisible": "Невидим",
  "paralyzed": "Парализован",
  "petrified": "Окаменел",
  "poisoned": "Отравлен",
  "prone": "Распластан",
  "restrained": "Скован",
  "stunned": "Ошеломлён",
  "unconscious": "Без сознания",
  "asleep": "Сон"
} as const
