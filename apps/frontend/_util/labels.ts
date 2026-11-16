//Printed labels that need no rulebook registry: safe to import in client components (unlike _util/rulebook.ts).
import {attributeMap, ENAttribute} from "@frontend/deps/types/Attribute"

//«Сила» from 'strength'
export const attributeName = (attribute: ENAttribute) => attributeMap[attribute].replace(/^./, (letter) => letter.toUpperCase())
export const attributeShort = (attribute: ENAttribute) => attributeName(attribute).slice(0, 3).toUpperCase()

//+3 / −1
export const signed = (value: number) => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`)

//4 or 4–11
export const span = (range: { min: number; max: number }) => range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`

//item rarities in order (the rulebook's itemRarityMap, kept registry-free for the shop panel)
export const rarityNames = {common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', veryRare: 'Очень редкий', legendary: 'Легендарный', artifact: 'Артефакт'} as const
