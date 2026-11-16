//Six characteristics with modifiers and saving throws; a click on the save requests it.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {attributeMap} from "@frontend/deps/types/Attribute"
import {typedKeys} from "@frontend/deps/_util/translationMap"
import {attributeName, signed} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"
import RequestButton from "@frontend/components/Room/RequestButton"

export default function Attributes({character}: { character: EvaluatedCharacter }) {
  return (
    <Block title="Характеристики">
      <div className="row row-cols-3 row-cols-md-6 g-2">
        {typedKeys(attributeMap).map((attribute) => {
          const {value, modifier} = character.attributes[attribute]
          const save = character.savingThrows[attribute]
          return (
            <div key={attribute} className="col">
              <div className="tb-stat">
                <div className="tb-stat__label">{attributeName(attribute)}</div>
                <div className="tb-stat__value">{signed(modifier)}</div>
                <div className="small">{value}</div>
                <RequestButton characterId={String(character._id)} choices={[{label: 'спас', subject: {kind: 'check', rollType: `save.${attribute}`}}]}
                               className={`btn btn-link btn-sm p-0 text-decoration-none ${save.proficiency ? 'text-primary' : 'text-muted'}`} title="Запросить спасбросок">
                  спас {signed(save.value + (save.proficiency ? character.proficiency : 0))}{save.proficiency ? ' ●' : ''}
                </RequestButton>
              </div>
            </div>
          )
        })}
      </div>
    </Block>
  )
}
