//Proficiencies, languages, defences, senses and current conditions as printed lists.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {languageMap} from "@frontend/deps/types/Character"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {conditionMap} from "@frontend/deps/types/Condition"
import {armorName, itemName, senseNames} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"

const Line = ({label, values}: { label: string; values: string[] }) =>
  values.length ? <div><span className="text-muted">{label}:</span> {values.join(', ')}</div> : null

export default function Proficiencies({character}: { character: EvaluatedCharacter }) {
  const {proficiencies} = character
  const senses = Object.entries(character.senses).filter(([, range]) => range)
    .map(([sense, range]) => `${senseNames[sense] ?? sense} ${range} фт.`)

  return (
    <Block title="Владения и защита">
      <div className="small d-flex flex-column gap-1">
        <Line label="Доспехи" values={proficiencies.armorProficiencies.map(armorName)}/>
        <Line label="Оружие" values={proficiencies.weaponProficiencies.map(itemName)}/>
        <Line label="Инструменты" values={proficiencies.toolProficiencies.map(itemName)}/>
        <Line label="Языки" values={proficiencies.languageProficiencies.map((language) => languageMap[language] ?? language)}/>
        <Line label="Сопротивление" values={character.resistances.map((type) => damageTypeMap[type])}/>
        <Line label="Иммунитет" values={character.immunities.map((type) => damageTypeMap[type])}/>
        <Line label="Иммунитет к состояниям" values={character.conditionImmunities.map((condition) => conditionMap[condition])}/>
        <Line label="Чувства" values={senses}/>
        <Line label="Состояния" values={character.conditions.map(({condition, level, note}) =>
          `${conditionMap[condition]}${level ? ` ${level}` : ''}${note ? ` (${note})` : ''}`)}/>
      </div>
    </Block>
  )
}
