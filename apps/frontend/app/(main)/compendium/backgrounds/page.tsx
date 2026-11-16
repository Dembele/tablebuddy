//Compendium: backgrounds with their abilities and origin feat.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import {allBackgrounds, featureById} from "@frontend/_util/compendium"
import {attributeMap} from "@frontend/deps/types/Attribute"

export default function BackgroundsPage() {
  return (
    <div className="container">
      <CompendiumNav active="backgrounds"/>
      <div className="table-responsive">
        <table className="table table-dark table-sm table-hover small align-middle">
          <thead><tr><th>Название</th><th>Характеристики</th><th>Черта</th></tr></thead>
          <tbody>
            {[...allBackgrounds].sort((a, b) => a.name.localeCompare(b.name)).map((background) => {
              const {options} = background.abilityScores
              return (
                <tr key={background.id}>
                  <td><Link href={`/compendium/backgrounds/${background.id}`}>{background.name}</Link></td>
                  <td>{options === 'any' ? 'любые' : options.map((attribute) => attributeMap[attribute]).join(', ')}</td>
                  <td><Link href={`/compendium/features/${background.feat.feature}`}>{featureById(background.feat.feature)?.name ?? background.feat.feature}</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
