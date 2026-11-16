//Compendium: the bestiary (Monster Manual 2024, core), filtered by name, creature type and challenge rating.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import Filters from "@frontend/components/Compendium/Filters"
import {allMonsters, challengeValue, matches, param} from "@frontend/_util/compendium"
import {creatureTypeMap, sizeMap} from "@frontend/deps/types/Race"
import {requireUser} from "@frontend/_util/session"
import {listMonsterTokens} from "@frontend/actions/monsters"

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function MonstersPage({searchParams}: { searchParams: Search }) {
  const [search, user] = await Promise.all([searchParams, requireUser()])
  const withToken = new Set(user.role === 'ГМ' ? (await listMonsterTokens()).data ?? [] : [])
  const [query, type, rating, campaign] = [param(search.q), param(search.type), param(search.cr), param(search.campaign)]
  const ratings = [...new Set(allMonsters.map((monster) => monster.challenge.rating))].sort((a, b) => challengeValue(a) - challengeValue(b))
  const found = allMonsters
    .filter((monster) => matches(monster.name, query) && (!type || monster.type === type || monster.altType === type) && (!rating || monster.challenge.rating === rating))
    .sort((a, b) => challengeValue(a.challenge.rating) - challengeValue(b.challenge.rating) || a.name.localeCompare(b.name))

  return (
    <div className="container">
      <CompendiumNav active="monsters"/>
      <Filters query={query} selects={[
        {name: 'type', label: 'Тип', value: type, options: Object.entries(creatureTypeMap)},
        {name: 'cr', label: 'Опасность', value: rating, options: ratings.map((entry) => [entry, entry])}
      ]}/>
      <div className="small text-muted mb-1">Найдено: {found.length}</div>
      <div className="table-responsive">
        <table className="table table-dark table-sm table-hover small align-middle">
          <thead><tr><th>Название</th><th>Опасность</th><th>Тип</th><th>Размер</th><th>КЗ</th><th>Хиты</th></tr></thead>
          <tbody>
            {found.map((monster) => (
              <tr key={monster.id}>
                <td>
                  {withToken.has(monster.id) && <img src={`/api/monsters/${monster.id}.webp`} alt="" width={24} height={24} className="rounded-circle me-1 align-middle"/>}
                  <Link href={`/compendium/monsters/${monster.id}${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ''}`}>{monster.name}</Link>
                </td>
                <td>{monster.challenge.rating}</td>
                <td>{creatureTypeMap[monster.type]}{monster.tags?.length ? <span className="text-muted"> ({monster.tags.join(', ')})</span> : null}</td>
                <td>{monster.size.map((size) => sizeMap[size]).join(' / ')}</td>
                <td>{monster.armorClass}</td>
                <td>{monster.hitPoints.average}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
