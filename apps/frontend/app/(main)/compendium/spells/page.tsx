//Compendium: every spell, filtered by name, level, school and class list.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import Filters from "@frontend/components/Compendium/Filters"
import {allSpells, classNameOf, levelLabel, matches, param, schoolName} from "@frontend/_util/compendium"
import {castingTimeMap} from "@frontend/deps/types/book/spells"
import {spellSchoolMap} from "@frontend/deps/types/Spell"
import {classMap} from "@frontend/deps/types/Class"

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function SpellsPage({searchParams}: { searchParams: Search }) {
  const search = await searchParams
  const [query, level, school, list] = [param(search.q), param(search.level), param(search.school), param(search.class)]
  const found = allSpells
    .filter((spell) => matches(spell.name, query) && (level === undefined || spell.level === Number(level))
      && (!school || spell.school === school) && (!list || spell.classes.includes(list as never)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  return (
    <div className="container">
      <CompendiumNav active="spells"/>
      <Filters query={query} selects={[
        {name: 'level', label: 'Уровень', value: level, options: Array.from({length: 10}, (_, index) => [String(index), levelLabel(index)])},
        {name: 'school', label: 'Школа', value: school, options: Object.entries(spellSchoolMap)},
        {name: 'class', label: 'Класс', value: list, options: Object.entries(classMap)}
      ]}/>
      <div className="small text-muted mb-1">Найдено: {found.length}</div>
      <div className="table-responsive">
        <table className="table table-dark table-sm table-hover small align-middle">
          <thead><tr><th>Название</th><th>Уровень</th><th>Школа</th><th>Время</th><th>Классы</th></tr></thead>
          <tbody>
            {found.map((spell) => (
              <tr key={spell.id}>
                <td>
                  <Link href={`/compendium/spells/${spell.id}`}>{spell.name}</Link>
                  {spell.duration.concentration && <span className="badge text-bg-secondary ms-1" title="Концентрация">К</span>}
                  {spell.ritual && <span className="badge text-bg-secondary ms-1" title="Ритуал">Р</span>}
                </td>
                <td>{levelLabel(spell.level)}</td>
                <td>{schoolName(spell.school)}</td>
                <td>{castingTimeMap[spell.castingTime]}</td>
                <td className="text-muted">{spell.classes.map(classNameOf).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
