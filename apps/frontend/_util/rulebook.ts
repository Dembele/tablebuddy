//Display lookups over the static rulebook (packages/data): ids on the character -> printed names. Unknown ids print as-is.
import {classes} from "@frontend/deps/data/loader"
import {subclasses} from "@frontend/deps/data/loader"
import {races} from "@frontend/deps/data/loader"
import {backgrounds} from "@frontend/deps/data/loader"
import {features} from "@frontend/deps/data/loader"
import {spells} from "@frontend/deps/data/loader"
import {items} from "@frontend/deps/data/loader"
import {armorClassMap} from "@frontend/deps/types/book/items"
import {GrantSource} from "@frontend/deps/interfaces/DB/Character"

//registry entry name by id, falling back to the id itself
const nameIn = (registry: Record<string, { name: string }>) => (id: string) => registry[id]?.name ?? id

export const className = nameIn(classes)
export const subclassName = nameIn(subclasses)
export const raceName = nameIn(races)
export const backgroundName = nameIn(backgrounds)
export const featureName = nameIn(features)
export const spellName = nameIn(spells)
export const itemName = nameIn(items)
export const armorName = (id: string) => armorClassMap[id as keyof typeof armorClassMap] ?? id

export const featureOf = (id: string) => (features as Record<string, { name: string; description?: string } | undefined>)[id]
export const itemOf = (id: string) => (items as Record<string, { name: string; attunement?: boolean; equipment?: { defaultSlot?: string } } | undefined>)[id]
export const spellOf = (id: string) => (spells as Record<string, { name: string; level: number; school: string } | undefined>)[id]

//registry-free labels live in _util/labels.ts (client-safe); re-exported so server code keeps one import
export {attributeName, attributeShort, signed} from "@frontend/_util/labels"

//where a grant came from, for badges and tooltips
export function sourceLabel(source: GrantSource): string {
  switch (source.type) {
    case 'class': return `${className(source.id)} ${source.level}`
    case 'subclass': return `${subclassName(source.id)} ${source.level}`
    case 'race': return raceName(source.id)
    case 'background': return backgroundName(source.id)
    case 'feature': return featureName(source.id)
    case 'item': return itemName(source.id)
    case 'monster': return 'Бестиарий'
    case 'custom': return source.note ?? 'Вручную'
  }
}

//printed names for speed types and senses
export const speedNames: Record<string, string> = {walk: 'ходьба', swim: 'плавание', fly: 'полёт', climb: 'лазание'}
export const senseNames: Record<string, string> = {darkvision: 'тёмное зрение', blindsight: 'слепое зрение', tremorsense: 'чувство вибрации', truesight: 'истинное зрение'}
