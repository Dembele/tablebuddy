//AC, hit points, initiative, speed, proficiency, passive perception, hit dice, death saves; requests: initiative, death save, hit die, rests.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {signed} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"
import RequestButton from "@frontend/components/Room/RequestButton"
import {hitDieChoices} from "@frontend/_util/requestChoices"

const Stat = ({label, value}: { label: string; value: string | number }) => (
  <div className="tb-stat">
    <div className="tb-stat__label">{label}</div>
    <div className="tb-stat__value">{value}</div>
  </div>
)

export default function CombatStats({character}: { character: EvaluatedCharacter }) {
  const {hitPoints, initiative, speed, deathSavingThrows} = character
  const id = String(character._id)
  const fired = character.inventory.reduce((total, entry) => total + (entry.spent ?? 0), 0)                             //ammo waiting to be picked up
  const initiativeBonus = initiative.value + (initiative.proficiency ? character.proficiency : 0)
  const hitDice = Object.entries(character.hitDice.max).filter(([, count]) => count > 0)
    .map(([die, count]) => `${character.hitDice.current[die as keyof typeof character.hitDice.current]}/${count} к${die}`)
  const otherSpeeds = (['swim', 'fly', 'climb'] as const).filter((type) => speed[type] !== undefined)
    .map((type) => `${{swim: 'плав.', fly: 'полёт', climb: 'лаз.'}[type]} ${speed[type] || speed.walk}`)

  return (
    <Block title="Бой">
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Stat label="КД" value={character.armorClass}/>
        <Stat label="Хиты" value={`${hitPoints.current}/${hitPoints.max}${hitPoints.temp ? ` +${hitPoints.temp}` : ''}`}/>
        <Stat label="Инициатива" value={signed(initiativeBonus)}/>
        <Stat label="Скорость" value={speed.walk}/>
        <Stat label="Бонус мастерства" value={signed(character.proficiency)}/>
        <Stat label="Пасс. восприятие" value={character.passivePerception}/>
      </div>
      <div className="small">
        {otherSpeeds.length > 0 && <div>Скорость: {otherSpeeds.join(', ')}</div>}
        <div>Кости хитов: {hitDice.join(', ') || '—'}</div>
        <div>Спасброски от смерти: успехи {deathSavingThrows.success}/3, провалы {deathSavingThrows.failure}/3{deathSavingThrows.isStable ? ' · стабилен' : ''}</div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <RequestButton characterId={id} choices={[{label: 'Инициатива', subject: {kind: 'check', rollType: 'initiative'}}]}>Инициатива</RequestButton>
        <RequestButton characterId={id} choices={[{label: 'Спасбросок от смерти', subject: {kind: 'check', rollType: 'save.death'}}]}>Спасбросок от смерти</RequestButton>
        <RequestButton characterId={id} choices={hitDieChoices(character)}>Кость хитов</RequestButton>
        <RequestButton characterId={id} choices={[{label: 'Короткий отдых', subject: {kind: 'rest', rest: 'short'}}]} className="btn btn-sm btn-outline-success py-0 px-1">Короткий отдых</RequestButton>
        <RequestButton characterId={id} choices={[{label: 'Продолжительный отдых', subject: {kind: 'rest', rest: 'long'}}]} className="btn btn-sm btn-outline-success py-0 px-1">Продолжительный отдых</RequestButton>
        {fired > 0 && <RequestButton characterId={id} choices={[{label: 'Собрать боеприпасы', subject: {kind: 'recover'}}]} className="btn btn-sm btn-outline-secondary py-0 px-1" title="После боя: вернётся половина выпущенного, если ГМ позволит">Собрать боеприпасы ({fired})</RequestButton>}
      </div>
    </Block>
  )
}
