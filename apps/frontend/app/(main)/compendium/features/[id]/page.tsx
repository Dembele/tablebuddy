//Compendium: one feat / feature — kind, prerequisites, rules text, ability increase, its rolls.
import {notFound} from "next/navigation"
import {ReactNode} from "react"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import {featureById, featureTypeName, prerequisiteText, rollText} from "@frontend/_util/compendium"
import {attributeMap} from "@frontend/deps/types/Attribute"
import {resetMap} from "@frontend/deps/types/Reset"

export default async function FeaturePage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const feature = featureById(id)
  if (!feature) notFound()

  const meta: Array<[string, ReactNode]> = [['Вид', featureTypeName(feature.type)]]
  if (feature.prerequisites?.length) meta.push(['Требования', feature.prerequisites.map(prerequisiteText).join('; ')])
  if (feature.repeatable) meta.push(['Повтор', 'можно взять несколько раз'])
  if (feature.abilityIncrease) {
    const {options, cap} = feature.abilityIncrease
    meta.push(['Увеличение характеристик', `${options === 'any' ? 'любая' : options.map((attribute) => attributeMap[attribute]).join(', ')} (макс. ${cap})`])
  }
  for (const resource of feature.resources ?? []) meta.push([resource.name, resetMap[resource.resetsOn] ?? resource.resetsOn])

  return (
    <EntryPage section="features" title={feature.name} meta={meta} description={feature.description}>
      {(feature.actions ?? []).length > 0 && (
        <div className="small">
          <div className="text-muted mb-1">Броски</div>
          <ul className="list-unstyled font-monospace">
            {feature.actions!.map((action) => (
              <li key={action.id}>
                {action.name}:
                {'attack' in action && action.attack && ' атака;'}
                {'damage' in action && ` урон ${rollText(action.damage)};`}
                {'pureRoll' in action && ` ${rollText(action.pureRoll)};`}
                {'save' in action && action.save && ` спасбросок ${attributeMap[action.save.attribute]}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </EntryPage>
  )
}
