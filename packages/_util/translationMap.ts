export function typedEntries<T extends Record<string, unknown>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

export function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>
}

export function typedValues<T extends object>(obj: T): Array<T[keyof T]> {
  return Object.values(obj) as Array<T[keyof T]>
}

export function typedFromEntries<K extends PropertyKey, V>(
  entries: Iterable<readonly [K, V]>
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>
}

export const translatedList = <T extends string>(items: T[] | undefined, translationMap: Record<T, string>) => {
  if (!items || items.length === 0) return ''

  return items.map(item => translationMap[item]).sort((a, b) => a.localeCompare(b)).join(', ')
}

export const translatedChoices = <T extends string>(choose: number = 0, from: T[] | undefined, translationMap: Record<T, string>) => {
  if (!from || from.length === 0 || choose === 0) return ''

  const translatedFrom = from.map(item => translationMap[item]).sort((a, b) => a.localeCompare(b)).join(', ')
  return choose ? `${choose} из списка: ${translatedFrom}` : translatedFrom
}

export const reverseMap = <K extends PropertyKey, V extends PropertyKey>(map: Record<K, V>): Record<V, K> => (
  typedFromEntries(typedEntries(map).map(([eng, ru]) => [ru, eng]))
)

/**
 * Function to translate value based on the provided map, doesn't care whether value is a key or a value in a map
 * in worst case its O(n)
 * in direct lookup its O(1)
 * @param value string to find a translation for
 * @param map object for a lookup
 */
export const translate = <K extends string, V extends string>(value: string, map: Record<K, V>): string => {
  if (value in map)
    return map[value as K]

  const reverseLookupMap = reverseMap(map)
  if (value in reverseLookupMap)
    return reverseLookupMap[value as V]

  return value
}