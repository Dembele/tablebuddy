//Skills with their total bonus: ● proficient, ◆ expertise; a click requests the check.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {skillAttributeMap, skillMap} from "@frontend/deps/types/Skill"
import {typedKeys} from "@frontend/deps/_util/translationMap"
import {attributeShort, signed} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"
import RequestButton from "@frontend/components/Room/RequestButton"

export default function Skills({character}: { character: EvaluatedCharacter }) {
  const skills = typedKeys(skillMap).sort((a, b) => skillMap[a].localeCompare(skillMap[b]))
  return (
    <Block title="Навыки">
      <ul className="list-unstyled mb-0 small">
        {skills.map((skill) => {
          const {value, proficiency, expertise} = character.skills[skill]
          const bonus = value + (expertise ? 2 * character.proficiency : proficiency ? character.proficiency : 0)
          return (
            <li key={skill} className={`d-flex justify-content-between ${proficiency || expertise ? 'text-primary' : ''}`}>
              <RequestButton characterId={String(character._id)} choices={[{label: skillMap[skill], subject: {kind: 'check', rollType: `skill.${skill}`}}]}
                             className="btn btn-link btn-sm p-0 text-reset text-decoration-none text-start" title="Запросить проверку">
                {expertise ? '◆' : proficiency ? '●' : '○'} {skillMap[skill]} <span className="text-muted">({attributeShort(skillAttributeMap[skill])})</span>
              </RequestButton>
              <span className="fw-bold">{signed(bonus)}</span>
            </li>
          )
        })}
      </ul>
    </Block>
  )
}
