//Compendium: every item (mundane and magic), filtered by name, type and rarity.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import Filters from "@frontend/components/Compendium/Filters"
import {allItems, itemTypeName, matches, money, param, rarityName} from "@frontend/_util/compendium"
import {itemRarityMap, itemTypeMap} from "@frontend/deps/types/book/items"

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function ItemsPage({searchParams}: { searchParams: Search }) {
  const search = await searchParams
  const [query, type, rarity] = [param(search.q), param(search.type), param(search.rarity)]
  const found = allItems
    .filter((item) => matches(item.name, query) && (!type || item.type === type) && (!rarity || item.rarity === rarity))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="container">
      <CompendiumNav active="items"/>
      <Filters query={query} selects={[
        {name: 'type', label: 'Тип', value: type, options: Object.entries(itemTypeMap)},
        {name: 'rarity', label: 'Редкость', value: rarity, options: Object.entries(itemRarityMap)}
      ]}/>
      <div className="small text-muted mb-1">Найдено: {found.length}</div>
      <div className="table-responsive">
        <table className="table table-dark table-sm table-hover small align-middle">
          <thead><tr><th>Название</th><th>Тип</th><th>Редкость</th><th>Цена</th><th>Вес</th></tr></thead>
          <tbody>
            {found.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/compendium/items/${item.id}`}>{item.name}</Link>
                  {item.attunement && <span className="badge text-bg-info ms-1" title="Требует настройки">Н</span>}
                </td>
                <td>{itemTypeName(item.type)}</td>
                <td>{rarityName(item.rarity)}</td>
                <td>{money(item.cost)}</td>
                <td>{item.weight ? `${item.weight} фнт.` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
