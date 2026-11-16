//Compendium: feats, fighting styles, boons, invocations (class / subclass / species features on request), by name and kind.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import Filters from "@frontend/components/Compendium/Filters"
import {allFeatures, featureTypeName, matches, param, prerequisiteText} from "@frontend/_util/compendium"
import {featureTypeMap} from "@frontend/deps/types/book/features"

type Search = Promise<Record<string, string | string[] | undefined>>
const featKinds = ['generalFeat', 'originFeat', 'fightingStyle', 'epicBoon', 'invocation']

export default async function FeaturesPage({searchParams}: { searchParams: Search }) {
  const search = await searchParams
  const [query, type] = [param(search.q), param(search.type)]
  const found = allFeatures
    .filter((feature) => matches(feature.name, query) && (type ? feature.type === type : featKinds.includes(feature.type)))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="container">
      <CompendiumNav active="features"/>
      <Filters query={query} selects={[{name: 'type', label: 'Вид', value: type, options: Object.entries(featureTypeMap)}]}/>
      <div className="small text-muted mb-1">Найдено: {found.length}{!type && ' (черты, стили, дары, воззвания — умения классов и видов выбираются фильтром)'}</div>
      <div className="table-responsive">
        <table className="table table-dark table-sm table-hover small align-middle">
          <thead><tr><th>Название</th><th>Вид</th><th>Требования</th></tr></thead>
          <tbody>
            {found.map((feature) => (
              <tr key={feature.id}>
                <td><Link href={`/compendium/features/${feature.id}`}>{feature.name}</Link>{feature.repeatable && <span className="badge text-bg-secondary ms-1" title="Можно взять несколько раз">×</span>}</td>
                <td>{featureTypeName(feature.type)}</td>
                <td className="text-muted">{(feature.prerequisites ?? []).map(prerequisiteText).join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
