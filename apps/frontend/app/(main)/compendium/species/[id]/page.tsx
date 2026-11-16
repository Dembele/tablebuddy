//Compendium: one species — type, size, speed, traits with rules text.
import {notFound} from "next/navigation"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import FeatureTimeline from "@frontend/components/Compendium/FeatureTimeline"
import {speciesById} from "@frontend/_util/compendium"
import {creatureTypeMap, sizeMap} from "@frontend/deps/types/Race"

export default async function SpeciesPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const species = speciesById(id)
  if (!species) notFound()

  return (
    <EntryPage section="species" title={species.name} description={species.description} meta={[
      ['Тип существа', creatureTypeMap[species.type] ?? species.type],
      ['Размер', species.size.map((size) => sizeMap[size]).join(' или ')],
      ['Скорость', `${species.speed.walk} фт.`]
    ]}>
      <h2 className="h5">Особенности</h2>
      <FeatureTimeline grants={species.features} showLevel={species.features.some((grant) => grant.level > 1)}/>
    </EntryPage>
  )
}
