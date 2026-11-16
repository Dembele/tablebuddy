//Stamped actions with a request button paying from what the character has, and limited-use resources (each one spendable on its own).
//Each action reads BG3-style from the backend's preview (атака +5 · урон 4–11 колющий); the formula as written sits in the tooltip.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {resetMap} from "@frontend/deps/types/Reset"
import {sourceLabel} from "@frontend/_util/rulebook"
import ActionSummary from "@frontend/components/Room/ActionSummary"
import Block from "@frontend/components/Character/sheet/Block"
import RequestButton from "@frontend/components/Room/RequestButton"
import {actionChoices} from "@frontend/_util/requestChoices"

export default function ActionsAndResources({character}: { character: EvaluatedCharacter }) {
  if (!character.actions.length && !character.resources.length) return null

  return (
    <Block title="Действия и ресурсы">
      {character.resources.length > 0 && (
        <ul className="list-unstyled small mb-2">
          {character.resources.map((resource, index) => (
            <li key={`${resource.name}-${index}`}>
              <RequestButton characterId={String(character._id)} choices={resource.current > 0 ? [{label: resource.name, subject: {kind: 'resource', name: resource.name, from: resource.from}}] : []}
                           className="btn btn-sm btn-outline-primary py-0 px-1" title={resource.current > 0 ? 'Потратить одно использование (решает ГМ)' : 'Использования закончились'}>{resource.name}</RequestButton>
              {' '}<b>{resource.current}/{resource.max}</b> <span className="text-muted">· {resetMap[resource.resetsOn]}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="list-unstyled small mb-0">
        {character.actions.map((action) => (
          <li key={action.id} className="mb-1">
            <RequestButton characterId={String(character._id)} choices={actionChoices(character, action)}>{action.name}</RequestButton>
            {' '}<span className="badge text-bg-secondary">{sourceLabel(action.from)}</span>
            <ActionSummary action={action}/>
          </li>
        ))}
      </ul>
    </Block>
  )
}
