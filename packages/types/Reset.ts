export type ENReset = keyof typeof resetMap
export type RUReset = typeof resetMap[ENReset]

export type ENDuration = keyof typeof durationMap
export type RUDuration = typeof durationMap[ENDuration]

// A span of time. `value` is required in practice for the valuefull units below, optional here to stay permissive.
export interface Duration {
  units: ENDuration
  value?: number
}

export const resetMap = {
  "turnStart": 'В начале хода',
  "shortRest": "После короткого отдыха",
  "longRest": "После долгого отдыха",
  "dawn": "На рассвете",                                                                                                //magic item charges; label only, user resets
  "never": "Не восстанавливается"
} as const

export const valuelessDurationMap = {
  'untilRest': "до отдыха",
  'untilLongRest': "до длинного отдыха",
  'permanent': "всегда",
  'instant': 'мгновенно'
}

export const valuefullDurationMap = {
  'rounds': 'раунды',
  'minutes': 'минуты',
  'hours': 'часы'
}

export const durationMap = {
  ...valuelessDurationMap,
  ...valuefullDurationMap,
} as const
