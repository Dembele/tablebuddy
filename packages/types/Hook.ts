export type ENHookTrigger = keyof typeof hookTriggerMap
export type RUHookTrigger = typeof hookTriggerMap[ENHookTrigger]


//will display a string in chat when condition met: e.g. on weapon use or when equipping item
//NEVER USE FOR ANYTHING ELSE
export const hookTriggerMap = {
  // object moments (fired by using / equipping / ending the owning spell, item or feature)
  'onUse': 'при использовании',
  'onEffect': 'после применения',
  'onEnd': 'при завершении',
  'onEquip': 'при экипировке',
  'onUnequip': 'при снятии',
  'onAttune': 'при настройке',

  // game loop events (fired while the effect is active)
  'onTurnStart': 'в начале хода',
  'onTurnEnd': 'в конце хода',
  'onDamageReceived': 'при получении урона',
  'onDamageDealt': 'при нанесении урона',
  'onConditionGained': 'при получении состояния',
  'onConditionLost': 'при снятии состояния',
  'onHeal': 'при лечении',
  'onDeath': 'при смерти'
} as const

//will purely print to chat, and even then not 100% guaranteed. Just a pure DM reminder
export type Hooks = Partial<Record<ENHookTrigger, string>>

//the reminders an action prints with its roll and shows on the sheet: how it is used, then what it does to the target
export const actionReminders = (hooks?: Hooks): string[] => (['onUse', 'onEffect'] as const).flatMap((trigger) => hooks?.[trigger] ? [hooks[trigger]] : [])
