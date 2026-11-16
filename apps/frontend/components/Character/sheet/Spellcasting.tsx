//Casting numbers per ability in use, slots, and spells grouped by level; a cast button pays with a slot or free cast.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {ENAttribute} from "@frontend/deps/types/Attribute"
import {attributeName, signed, sourceLabel, spellOf} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"
import Link from "next/link"
import {PrepareButton} from "@frontend/components/Character/sheet/SheetButtons"
import RequestButton from "@frontend/components/Room/RequestButton"
import {actionChoices, castChoices} from "@frontend/_util/requestChoices"

type SpellEntry = EvaluatedCharacter['spellcasting']['spells'][number]

export default function Spellcasting({character}: { character: EvaluatedCharacter }) {
  const {spellcasting} = character
  const slots = Object.entries(spellcasting.slots).flatMap(([level, slot]) => slot?.max ? [{level, ...slot}] : [])
  if (!spellcasting.spells.length && !spellcasting.pactSlots && !slots.length) return null

  //the spell's own action when it has a roll, a plain cast otherwise
  const choicesFor = (entry: SpellEntry) => {
    const action = character.actions.find((candidate) => candidate.spell === entry.spell && JSON.stringify(candidate.from) === JSON.stringify(entry.from))
    return action ? actionChoices(character, action) : castChoices(character, entry)
  }

  const abilities = [...new Set(spellcasting.spells.map((entry) => entry.ability))] as ENAttribute[]
  const byLevel = new Map<number, SpellEntry[]>()
  for (const entry of spellcasting.spells) {
    const level = spellOf(entry.spell)?.level ?? 0
    byLevel.set(level, [...(byLevel.get(level) ?? []), entry])
  }

  return (
    <Block title="Заклинания">
      <div className="d-flex flex-wrap gap-3 small mb-2">
        {abilities.map((ability) => {
          const modifier = character.attributes[ability].modifier
          const difficulty = 8 + modifier + character.proficiency + spellcasting.dcBonus
          return <span key={ability}>{attributeName(ability)}: СЛ {difficulty}, атака {signed(modifier + character.proficiency + spellcasting.attackBonus)}</span>
        })}
      </div>
      <div className="d-flex flex-wrap gap-2 small mb-2">
        {slots.map((slot) => <span key={slot.level} className="badge text-bg-dark border">{slot.level} ур.: {slot.current}/{slot.max}</span>)}
        {spellcasting.pactSlots && (
          <span className="badge text-bg-dark border">
            Магия договора ({spellcasting.pactSlots.level} ур.): {spellcasting.pactSlots.current}/{spellcasting.pactSlots.max}
          </span>
        )}
      </div>
      {[...byLevel.entries()].sort(([a], [b]) => a - b).map(([level, entries]) => (
        <div key={level} className="mb-2">
          <div className="small text-muted">{level === 0 ? 'Заговоры' : `${level} уровень`}</div>
          <ul className="list-unstyled small mb-0">
            {entries.map((entry, index) => (
              <li key={`${entry.spell}-${index}`}>
                {entry.prepared || entry.alwaysPrepared ? '●' : '○'}{' '}
                <RequestButton characterId={String(character._id)} choices={choicesFor(entry)} title="Сотворить"
                               className="btn btn-link btn-sm p-0 text-reset text-decoration-none">{spellOf(entry.spell)?.name ?? entry.spell}</RequestButton>
                {level > 0 && !entry.alwaysPrepared && (entry.from.type === 'class' || entry.from.type === 'subclass') && (
                  <PrepareButton characterId={String(character._id)} spell={entry.spell} source={`${entry.from.type}:${entry.from.id}`} prepared={entry.prepared}/>
                )}
                <Link href={`/compendium/spells/${entry.spell}`} className="ms-1 small text-muted" title="В справочнике">ⓘ</Link>
                <span className="text-muted">
                  {' · '}{sourceLabel(entry.from)}
                  {entry.alwaysPrepared && ' · всегда'}
                  {entry.freeCast && ` · бесплатно: ${entry.freeCast.available ? 'есть' : 'потрачено'}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Block>
  )
}
