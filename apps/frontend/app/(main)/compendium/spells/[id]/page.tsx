//Compendium: one spell — meta block, rules text, upcast note, its rolls as written.
import {notFound} from "next/navigation"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import {rollText, levelLabel, money, schoolName, spellById, spellMeta} from "@frontend/_util/compendium"
import {attributeMap} from "@frontend/deps/types/Attribute"

export default async function SpellPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const spell = spellById(id)
  if (!spell) notFound()

  return (
    <EntryPage section="spells" title={spell.name} subtitle={`${levelLabel(spell.level)}, ${schoolName(spell.school).toLowerCase()}`}
               meta={[...spellMeta(spell), ...(spell.components.cost ? [['Стоимость компонента', `${money(spell.components.cost)}${spell.components.consumed ? ', расходуется' : ''}`] as [string, string]] : [])]}
               description={spell.description}>
      {spell.upgrade && <div className="description mb-3"><b>{spell.level === 0 ? 'Усиление заговора. ' : 'На более высоких уровнях. '}</b>{spell.upgrade}</div>}
      {(spell.actions ?? []).length > 0 && (
        <div className="small">
          <div className="text-muted mb-1">Броски</div>
          <ul className="list-unstyled font-monospace">
            {spell.actions!.map((action) => (
              <li key={action.id}>
                {action.name}:
                {'attack' in action && action.attack && ' атака заклинанием;'}
                {'damage' in action && ` ${rollText(action.damage)};`}
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
