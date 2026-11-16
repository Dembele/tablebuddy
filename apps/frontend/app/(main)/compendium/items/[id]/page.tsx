//Compendium: one item — type, rarity, price, weapon / armor numbers, attunement, spells it names, sibling variants.
import Link from "next/link"
import {notFound} from "next/navigation"
import {ReactNode} from "react"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import {allItems, itemById, itemTypeName, money, rarityName, rollText, spellById} from "@frontend/_util/compendium"
import {weaponMasteryMap, weaponPropertyMap} from "@frontend/deps/types/book/items"
import {armorClassMap, armorPropertyMap} from "@frontend/deps/types/book/items"

type Loose = Record<string, unknown>
const propertyName = (id: string) => (weaponPropertyMap as Record<string, string>)[id] ?? (armorPropertyMap as Record<string, string>)[id] ?? id

export default async function ItemPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const item = itemById(id)
  if (!item) notFound()
  const fields = item as unknown as Loose

  const meta: Array<[string, ReactNode]> = [
    ['Тип', itemTypeName(item.type)], ['Редкость', rarityName(item.rarity)], ['Цена', money(item.cost)],
    ['Вес', item.weight ? `${item.weight} фнт.` : '—']
  ]
  if (item.attunement) meta.push(['Настройка', typeof fields.attunementBy === 'string' ? `требуется (${fields.attunementBy})` : 'требуется'])
  if (typeof fields.mastery === 'string') meta.push(['Приём', weaponMasteryMap[fields.mastery as keyof typeof weaponMasteryMap] ?? fields.mastery])
  if (fields.range && typeof fields.range === 'object') {
    const range = fields.range as { normal: number; long: number }
    meta.push(['Дистанция', `${range.normal}/${range.long} фт.`])
  }
  if (typeof fields.armorClass === 'string') meta.push(['Категория', armorClassMap[fields.armorClass as keyof typeof armorClassMap] ?? fields.armorClass])
  if (typeof fields.AC === 'string') meta.push(['КД', fields.AC.replace(/\{character\.attributes\.dexterity\.modifier\}/g, 'мод. Лов').replace(/min\(/g, 'макс. ').replace(/[()]/g, '')])
  if (typeof fields.base === 'string') meta.push(['Основа', fields.base])
  const properties = item.equipment?.properties ?? []
  if (properties.length) meta.push(['Свойства', properties.map(propertyName).join(', ')])

  const actions = (fields.actions as Array<Loose> | undefined) ?? []
  const named = (fields.spells as Array<{ spell: string; charges?: number }> | undefined) ?? []
  const variantOf = typeof fields.variantOf === 'string' ? fields.variantOf : undefined
  const siblings = variantOf ? allItems.filter((other) => (other as unknown as Loose).variantOf === variantOf && other.id !== item.id) : []

  return (
    <EntryPage section="items" title={item.name} meta={meta} description={item.description}>
      {actions.length > 0 && (
        <div className="small mb-3">
          <div className="text-muted mb-1">Броски</div>
          <ul className="list-unstyled font-monospace mb-0">
            {actions.map((action) => (
              <li key={String(action.id)}>
                {String(action.name)}:{typeof action.attack === 'string' && ' атака;'}
                {typeof action.damage === 'string' && ` урон ${rollText(action.damage)};`}
                {typeof action.pureRoll === 'string' && ` ${rollText(action.pureRoll)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {named.length > 0 && (
        <div className="small mb-3">
          <div className="text-muted mb-1">Заклинания</div>
          {named.map((entry) => (
            <span key={entry.spell} className="me-2">
              <Link href={`/compendium/spells/${entry.spell}`}>{spellById(entry.spell)?.name ?? entry.spell}</Link>{entry.charges ? ` (${entry.charges} зар.)` : ''}
            </span>
          ))}
        </div>
      )}
      {siblings.length > 0 && (
        <div className="small">
          <div className="text-muted mb-1">Другие варианты</div>
          {siblings.map((other) => <Link key={other.id} href={`/compendium/items/${other.id}`} className="me-2">{other.name}</Link>)}
        </div>
      )}
    </EntryPage>
  )
}
