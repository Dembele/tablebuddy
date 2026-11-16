//Compendium home: sections with counts, and one search across every domain (first hits per domain).
import Link from "next/link"
import CompendiumNav, {Section} from "@frontend/components/Compendium/CompendiumNav"
import Filters from "@frontend/components/Compendium/Filters"
import {allBackgrounds, allClasses, allFeatures, allItems, allSpecies, allSpells, allSubclasses, matches, param} from "@frontend/_util/compendium"

type Search = Promise<Record<string, string | string[] | undefined>>
type Hit = { href: string; name: string }
const hitsPerDomain = 12

export default async function CompendiumPage({searchParams}: { searchParams: Search }) {
  const query = param((await searchParams).q)
  const domains: Array<{ section: Section; title: string; entries: Hit[] }> = [
    {section: 'spells', title: 'Заклинания', entries: allSpells.map((spell) => ({href: `/compendium/spells/${spell.id}`, name: spell.name}))},
    {section: 'items', title: 'Предметы', entries: allItems.map((item) => ({href: `/compendium/items/${item.id}`, name: item.name}))},
    {section: 'features', title: 'Черты и умения', entries: allFeatures.map((feature) => ({href: `/compendium/features/${feature.id}`, name: feature.name}))},
    {section: 'classes', title: 'Классы и подклассы', entries: [
      ...allClasses.map((entry) => ({href: `/compendium/classes/${entry.id}`, name: entry.name})),
      ...allSubclasses.map((subclass) => ({href: `/compendium/subclasses/${subclass.id}`, name: subclass.name}))
    ]},
    {section: 'species', title: 'Виды', entries: allSpecies.map((species) => ({href: `/compendium/species/${species.id}`, name: species.name}))},
    {section: 'backgrounds', title: 'Предыстории', entries: allBackgrounds.map((background) => ({href: `/compendium/backgrounds/${background.id}`, name: background.name}))}
  ]

  return (
    <div className="container">
      <CompendiumNav/>
      <Filters query={query}/>
      <div className="row g-3">
        {domains.map(({section, title, entries}) => {
          const hits = query ? entries.filter((entry) => matches(entry.name, query)).sort((a, b) => a.name.localeCompare(b.name)) : []
          if (query && hits.length === 0) return null
          return (
            <div key={section} className="col-md-6 col-lg-4">
              <div className="card bg-dark h-100">
                <div className="card-header fw-bold d-flex justify-content-between">
                  <Link href={`/compendium/${section}${query && section !== 'classes' && section !== 'backgrounds' ? `?q=${encodeURIComponent(query)}` : ''}`}>{title}</Link>
                  <span className="text-muted small">{query ? hits.length : entries.length}</span>
                </div>
                {query && (
                  <ul className="list-unstyled small card-body mb-0">
                    {hits.slice(0, hitsPerDomain).map((hit) => <li key={hit.href}><Link href={hit.href}>{hit.name}</Link></li>)}
                    {hits.length > hitsPerDomain && <li className="text-muted">и ещё {hits.length - hitsPerDomain}…</li>}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
