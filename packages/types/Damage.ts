export type ENDamageType = keyof typeof damageTypeMap;
export type RUDamageType = typeof damageTypeMap[ENDamageType];

export const damageTypeMap = {
  // Non-magical physical
  'slashing': 'рубящий',
  'piercing': 'колющий',
  'bludgeoning': 'дробящий',

  // Magical physical (used in +N weapon to correlate correctly with rules, or in special cases like monks weapon treated as magical)
  // to bypass some resistances / immunities
  'magical_slashing': 'магический рубящий',
  'magical_piercing': 'магический колющий',
  'magical_bludgeoning': 'магический дробящий',

  // Elemental damage types
  'acid': 'кислота',
  'cold': 'холод',
  'fire': 'огонь',
  'force': 'силовое поле',
  'lightning': 'электричество',
  'thunder': 'звук',

  // Energy damage types
  'necrotic': 'некротический',
  'poison': 'яд',
  'psychic': 'психический',
  'radiant': 'излучение',

  // Special damage types
  'magical': 'магический',
  'nonlethal': 'несмертельный',

  // Conditional damage (for specific cases)
  'bleed': 'кровотечение',
  'falling': 'падение',
  'starvation': 'голод',
  'suffocation': 'удушье'
} as const