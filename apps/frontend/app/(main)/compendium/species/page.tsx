//Compendium: species (lineages grouped under their species).
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import {allSpecies, matches, param} from "@frontend/_util/compendium"
import Filters from "@frontend/components/Compendium/Filters"
import {sizeMap} from "@frontend/deps/types/Race"

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function SpeciesListPage({searchParams}: { searchParams: Search }) {
  const query = param((await searchParams).q)
  const found = allSpecies.filter((species) => matches(species.name, query)).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="container">
      <CompendiumNav active="species"/>
      <Filters query={query}/>
      <div className="row g-3">
        {found.map((species) => (
          <div key={species.id} className="col-sm-6 col-lg-4">
            <div className="card bg-dark h-100"><div className="card-body">
              <h2 className="h6 mb-1"><Link href={`/compendium/species/${species.id}`}>{species.name}</Link></h2>
              <div className="small text-muted">{species.size.map((size) => sizeMap[size]).join(' или ')} · скорость {species.speed.walk} фт.</div>
            </div></div>
          </div>
        ))}
      </div>
    </div>
  )
}
