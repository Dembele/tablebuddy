'use client'
//Editor sections over the raw character. Every change is a human edit of stored state — nothing is derived here.
//What changes during play (identity, hit points, pack, slots and pools) is open; what is set once (classes, scores, proficiencies,
//features, formulas) is folded with a one-line digest of its current values. Lists are rows of bare inputs under one header line.
import {CSSProperties, useState} from "react"
import {FaXmark} from "react-icons/fa6"
import type {ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {attributeMap} from "@frontend/deps/types/Attribute"
import {skillMap} from "@frontend/deps/types/Skill"
import {hitDiceArray} from "@frontend/deps/types/Character"
import {typedKeys} from "@frontend/deps/_util/translationMap"
import {attributeShort} from "@frontend/_util/labels"
import {CheckField, ChipPick, InlineField, NumberField, Section, SelectField, TextField} from "@frontend/components/Character/editor/fields"
import {SetField} from "@frontend/components/Character/editor/useDraft"
import type {EditorOptions} from "@frontend/components/Character/editor/options"
import IconButton from "@frontend/components/UI/IconButton"
import SuggestInput from "@frontend/components/UI/SuggestInput"

interface SectionProps {
  draft: ICharacter
  set: SetField
  options: EditorOptions
}

const capital = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase())
const newEntryId = () => Math.random().toString(36).slice(2, 10)
const columns = (template: string) => ({'--cols': template} as CSSProperties)
const Remove = ({label, onClick}: { label: string; onClick: () => void }) => <IconButton size="sm" tone="danger" label={label} icon={<FaXmark/>} onClick={onClick}/>

export function IdentitySection({draft, set, options}: SectionProps) {
  return (
    <Section title="Основное" open>
      <div className="row g-2">
        <div className="col-sm-5"><TextField label="Имя" path="name" value={draft.name} set={set}/></div>
        <div className="col-sm-4"><SelectField label="Вид" path="race" value={draft.race} options={options.races} set={set} empty="—"/></div>
        <div className="col-sm-3"><SelectField label="Размер" path="size" value={draft.size} options={options.sizes} set={set} empty="—"/></div>
        <div className="col-sm-5"><SelectField label="Предыстория" path="background" value={draft.background} options={options.backgrounds} set={set} empty="—"/></div>
        <div className="col-6 col-sm-3"><NumberField label="Опыт" path="xp" value={draft.xp} set={set} required min={0}/></div>
        <div className="col-6 col-sm-4 d-flex align-items-end pb-2"><CheckField label="НИП" path="isNPC" value={draft.isNPC} set={set}/></div>
        {draft.rolledScores?.length ? (
          <div className="col-12 small d-flex align-items-center gap-2">
            <span>Броски характеристик: {draft.rolledScores.map((score) => score.total).join(', ')}</span>
            {options.isDM && <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => set('rolledScores', [])}>Сбросить</button>}
          </div>
        ) : null}
        <div className="col-12">
          <label className="form-label w-100 small mb-0">Заметки
            <textarea className="form-control form-control-sm" rows={2} value={draft.notes ?? ''} onChange={(event) => set('notes', event.target.value)}/>
          </label>
        </div>
      </div>
    </Section>
  )
}

export function VitalsSection({draft, set, options}: SectionProps) {
  const [allDice, setAllDice] = useState(false)
  const dice = hitDiceArray.filter((die) => allDice || draft.hitDice.max[die] > 0 || draft.hitDice.current[die] > 0)
  const speeds = [['walk', 'Ходьба'], ['swim', 'Плавание'], ['fly', 'Полёт'], ['climb', 'Лазание']] as const
  const senses = [['darkvision', 'Тёмное зрение'], ['blindsight', 'Слепое зрение'], ['tremorsense', 'Вибрация'], ['truesight', 'Истинное']] as const

  return (
    <Section title="Хиты и бой" open>
      <div className="d-flex flex-wrap align-items-end gap-2">
        <div className="tb-num-field tb-num-field--mid"><NumberField label={options.maxima.hitPoints === undefined ? 'Хиты' : `Хиты / ${options.maxima.hitPoints}`} path="hitPoints.current" value={draft.hitPoints.current} set={set} required/></div>
        <div className="tb-num-field tb-num-field--mid"><NumberField label="Временные" path="hitPoints.temp" value={draft.hitPoints.temp} set={set}/></div>
        <div className="ms-sm-3">
          <div className="tb-eyebrow">Спасброски от смерти</div>
          <div className="d-flex align-items-end gap-2">
            <div className="tb-num-field"><NumberField label="успехи" path="deathSavingThrows.success" value={draft.deathSavingThrows.success} set={set} required min={0} max={3}/></div>
            <div className="tb-num-field"><NumberField label="провалы" path="deathSavingThrows.failure" value={draft.deathSavingThrows.failure} set={set} required min={0} max={3}/></div>
            <div className="pb-2"><CheckField label="стабилен" path="deathSavingThrows.isStable" value={draft.deathSavingThrows.isStable} set={set}/></div>
          </div>
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-end gap-3">
        {dice.map((die) => (
          <div key={die} className="d-flex align-items-end gap-1">
            <span className="small text-muted pb-2">к{die}</span>
            <div className="tb-num-field"><NumberField label="есть" path={`hitDice.current.${die}`} value={draft.hitDice.current[die]} set={set} required min={0}/></div>
            <div className="tb-num-field"><NumberField label="всего" path={`hitDice.max.${die}`} value={draft.hitDice.max[die]} set={set} required min={0}/></div>
          </div>
        ))}
        <button type="button" className="btn btn-link btn-sm p-0 mb-2" onClick={() => setAllDice((current) => !current)}>{allDice ? 'только свои кости' : 'другие кости хитов'}</button>
      </div>
      <details className="tb-section">
        <summary><span className="tb-eyebrow">Скорость, чувства, крит</span><span className="text-muted small ms-auto">ходьба {draft.speed.walk}</span></summary>
        <div className="row g-2">
          {speeds.map(([kind, label]) => <div key={kind} className="col-3"><NumberField label={label} path={`speed.${kind}`} value={draft.speed[kind]} set={set} required={kind === 'walk'} min={0}/></div>)}
          {senses.map(([kind, label]) => <div key={kind} className="col-3"><NumberField label={label} path={`senses.${kind}`} value={draft.senses[kind]} set={set} min={0}/></div>)}
          <div className="col-6"><NumberField label="Крит на меньшем броске (−N к 20)" path="critThresholdMod" value={draft.critThresholdMod} set={set} required min={0}/></div>
        </div>
      </details>
    </Section>
  )
}

export function InventorySection({draft, set, options}: SectionProps) {
  const coins = [['platinum', 'ПМ'], ['gold', 'ЗМ'], ['electrum', 'ЭМ'], ['silver', 'СМ'], ['copper', 'ММ']] as const
  const itemName = new Map(options.items.map((option) => [option.id, option.name]))

  return (
    <Section title="Снаряжение" digest={`предметов: ${draft.inventory.length}`} open>
      <div className="row row-cols-5 g-2 mb-2">
        {coins.map(([coin, label]) => <div key={coin} className="col"><NumberField label={label} path={`currency.${coin}`} value={draft.currency[coin]} set={set} required min={0}/></div>)}
      </div>
      {draft.inventory.length > 0 && (
        <div className="overflow-auto">
          <div className="tb-grid-rows" style={{...columns('minmax(120px, 1.6fr) minmax(96px, 1fr) 60px minmax(96px, 1fr) 44px 60px minmax(96px, 1.2fr) 26px'), minWidth: 660}}>
            {['Предмет', 'Основа', 'Кол.', 'Надето', 'Настр.', 'Заряды', 'Заметка', ''].map((heading, index) => <span key={index} className="tb-eyebrow">{heading}</span>)}
            {draft.inventory.map((entry, index) => {
              const name = itemName.get(entry.item) ?? entry.item
              const bases = options.bases[entry.item]
              return [
                <span key={`${entry.id}-name`} className="small text-truncate" title={name}>{name}</span>,
                bases
                  ? <SelectField key={`${entry.id}-base`} bare label={`${name}: основа`} path={`inventory.${index}.base`} value={entry.base} set={set} empty="— выбрать —"
                                 options={bases.map((id) => ({id, name: itemName.get(id) ?? id}))}/>
                  : <span key={`${entry.id}-base`}/>,
                <NumberField key={`${entry.id}-quantity`} bare label={`${name}: количество`} path={`inventory.${index}.quantity`} value={entry.quantity} set={set} required min={0}/>,
                <SelectField key={`${entry.id}-slot`} bare label={`${name}: надето`} path={`inventory.${index}.equipped`} value={entry.equipped} options={options.slots} set={set} empty="—"/>,
                <input key={`${entry.id}-attuned`} type="checkbox" className="form-check-input m-0 mx-auto" aria-label={`${name}: настроен`} checked={!!entry.attuned} onChange={(event) => set(`inventory.${index}.attuned`, event.target.checked)}/>,
                <NumberField key={`${entry.id}-charges`} bare label={`${name}: заряды`} path={`inventory.${index}.charges`} value={entry.charges} set={set} min={0}/>,
                <TextField key={`${entry.id}-note`} bare label={`${name}: заметка`} path={`inventory.${index}.note`} value={entry.note} set={set}/>,
                <Remove key={`${entry.id}-remove`} label={`Убрать: ${name}`} onClick={() => set('inventory', draft.inventory.filter((_, position) => position !== index))}/>
              ]
            })}
          </div>
        </div>
      )}
      <SuggestInput className="mt-2" label="Добавить предмет" placeholder="+ Добавить предмет: начните вводить название…" options={options.items}
                    onPick={(id) => set('inventory', [...draft.inventory, {id: newEntryId(), item: id as ICharacter['inventory'][number]['item'], quantity: 1}])}/>
    </Section>
  )
}

export function MagicSection({draft, set, options}: SectionProps) {
  const {spellcasting} = draft
  //slot levels the character really has: an evaluated cap above zero, or something still stored in them
  const levels = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).filter((level) => spellcasting.slots[level] && ((options.maxima.slots[level] ?? 1) > 0 || spellcasting.slots[level]!.current > 0))
  const cap = (max: number | undefined) => max === undefined ? '' : ` / ${max}`
  const [startsOpen] = useState(levels.length > 0 || !!spellcasting.pactSlots || draft.resources.length > 0)
  const digest = [levels.length || spellcasting.pactSlots ? 'ячейки' : null, draft.resources.length ? `ресурсов: ${draft.resources.length}` : null, spellcasting.spells.length ? `заклинаний: ${spellcasting.spells.length}` : null]
    .filter(Boolean).join(' · ') || 'нет'

  return (
    <Section title="Ячейки, ресурсы, заклинания" digest={digest} open={startsOpen}>
      {(levels.length > 0 || spellcasting.pactSlots) && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {levels.map((level) => (
            <div key={level} className="tb-num-field"><NumberField label={`${level} ур.${cap(options.maxima.slots[level])}`} path={`spellcasting.slots.${level}.current`} value={spellcasting.slots[level]!.current} set={set} required min={0}/></div>
          ))}
          {spellcasting.pactSlots && <div className="tb-num-field tb-num-field--mid"><NumberField label={`Договор${cap(options.maxima.pactSlots)}`} path="spellcasting.pactSlots.current" value={spellcasting.pactSlots.current} set={set} required min={0}/></div>}
        </div>
      )}
      {draft.resources.length > 0 && (
        <div className="tb-grid-rows mb-2" style={columns('minmax(0, 1fr) 72px')}>
          <span className="tb-eyebrow">Ресурс</span><span className="tb-eyebrow">Сейчас</span>
          {draft.resources.map((resource, index) => [
            <span key={`${index}-name`} className="small">{resource.name} <span className="text-muted">· макс. {options.maxima.resources[index] ?? resource.max}</span></span>,
            <NumberField key={`${index}-current`} bare label={`${resource.name}: сейчас`} path={`resources.${index}.current`} value={resource.current} set={set} required min={0}/>
          ])}
        </div>
      )}
      {spellcasting.spells.length > 0 && (
        <details className="tb-section">
          <summary><span className="tb-eyebrow">Заклинания ({spellcasting.spells.length})</span></summary>
          <div className="tb-grid-rows" style={columns('minmax(0, 1fr) auto auto 26px')}>
            {spellcasting.spells.map((entry, index) => {
              const name = options.names[entry.spell] ?? entry.spell
              return [
                <span key={`${index}-name`} className="small text-truncate">{name}</span>,
                <CheckField key={`${index}-prepared`} label="подготовлено" path={`spellcasting.spells.${index}.prepared`} value={entry.prepared} set={set}/>,
                entry.freeCast ? <CheckField key={`${index}-free`} label="бесплатно есть" path={`spellcasting.spells.${index}.freeCast.available`} value={entry.freeCast.available} set={set}/> : <span key={`${index}-free`}/>,
                <Remove key={`${index}-remove`} label={`Убрать: ${name}`} onClick={() => set('spellcasting.spells', spellcasting.spells.filter((_, position) => position !== index))}/>
              ]
            })}
          </div>
        </details>
      )}
      {digest === 'нет' && <p className="small text-muted mb-0">У персонажа нет ячеек, ресурсов и заклинаний — их добавляет помощник создания и повышения уровня.</p>}
    </Section>
  )
}

export function ConditionsSection({draft, set, options}: SectionProps) {
  const [startsOpen] = useState(draft.conditions.length > 0)
  const names = new Map(options.conditions.map((option) => [option.id, option.name]))
  const digest = draft.conditions.map((entry) => `${names.get(entry.condition) ?? entry.condition}${entry.level ? ` ${entry.level}` : ''}`).join(', ') || 'нет'

  return (
    <Section title="Состояния" digest={digest} open={startsOpen}>
      {draft.conditions.length > 0 && (
        <div className="tb-grid-rows mb-2" style={columns('minmax(0, 1.2fr) 72px minmax(0, 1.4fr) 26px')}>
          {['Состояние', 'Уровень', 'Заметка', ''].map((heading, index) => <span key={index} className="tb-eyebrow">{heading}</span>)}
          {draft.conditions.map((entry, index) => [
            <SelectField key={`${index}-condition`} bare label="Состояние" path={`conditions.${index}.condition`} value={entry.condition} options={options.conditions} set={set}/>,
            <NumberField key={`${index}-level`} bare label="Уровень" path={`conditions.${index}.level`} value={entry.level} set={set} min={1}/>,
            <TextField key={`${index}-note`} bare label="Заметка" path={`conditions.${index}.note`} value={entry.note} set={set}/>,
            <Remove key={`${index}-remove`} label="Снять состояние" onClick={() => set('conditions', draft.conditions.filter((_, position) => position !== index))}/>
          ])}
        </div>
      )}
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => set('conditions', [...draft.conditions, {condition: 'poisoned'}])}>Добавить состояние</button>
    </Section>
  )
}

export function ClassesSection({draft, set, options}: SectionProps) {
  const update = (index: number, change: Partial<ICharacter['classes'][number]>) =>
    set('classes', draft.classes.map((entry, position) => position === index ? {...entry, ...change} : entry))
  const names = new Map(options.classes.map((option) => [option.id, option.name]))
  const digest = draft.classes.map((entry) => `${names.get(entry.class) ?? entry.class} ${entry.level}`).join(' / ') || 'без класса'

  return (
    <Section title="Классы" digest={digest}>
      {draft.classes.length > 0 && (
        <div className="tb-grid-rows mb-2" style={columns('minmax(0, 1fr) minmax(0, 1fr) 72px 26px')}>
          {['Класс', 'Подкласс', 'Уровень', ''].map((heading, index) => <span key={index} className="tb-eyebrow">{heading}</span>)}
          {draft.classes.map((entry, index) => [
            <select key={`${index}-class`} className="form-select form-select-sm" aria-label={index === 0 ? 'Начальный класс' : 'Класс'} title={index === 0 ? 'Начальный класс' : undefined} value={entry.class}
                    onChange={(event) => update(index, {class: event.target.value as typeof entry.class, subclass: undefined})}>
              {options.classes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>,
            <select key={`${index}-subclass`} className="form-select form-select-sm" aria-label="Подкласс" value={entry.subclass ?? ''} onChange={(event) => update(index, {subclass: (event.target.value || undefined) as typeof entry.subclass})}>
              <option value="">—</option>
              {options.subclasses.filter((option) => option.class === entry.class).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>,
            <input key={`${index}-level`} type="number" min={1} max={20} className="form-control form-control-sm" aria-label="Уровень" value={entry.level} onChange={(event) => update(index, {level: Number(event.target.value) || 1})}/>,
            <Remove key={`${index}-remove`} label="Убрать класс" onClick={() => set('classes', draft.classes.filter((_, position) => position !== index))}/>
          ])}
        </div>
      )}
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => set('classes', [...draft.classes, {class: options.classes[0].id, level: 1}])}>Добавить класс</button>
      <p className="small text-muted mb-0 mt-2">Первый в списке — начальный класс. Умения уровня здесь не выдаются: это делает помощник повышения уровня.</p>
    </Section>
  )
}

export function AbilitiesSection({draft, set}: SectionProps) {
  const digest = typedKeys(attributeMap).map((attribute) => `${attributeShort(attribute)} ${draft.attributes[attribute].value}`).join(' · ')
  return (
    <Section title="Характеристики и навыки" digest={digest}>
      <div className="row g-2 mb-2">
        {typedKeys(attributeMap).map((attribute) => (
          <div key={attribute} className="col-4 col-sm-2">
            <NumberField label={capital(attributeMap[attribute])} path={`attributes.${attribute}.value`} value={draft.attributes[attribute].value} set={set} required min={1} max={30}/>
            <CheckField label="спасбр." path={`savingThrows.${attribute}.proficiency`} value={draft.savingThrows[attribute].proficiency} set={set}/>
          </div>
        ))}
      </div>
      <div className="tb-eyebrow mb-1">Навыки: владение / компетентность</div>
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-1">
        {typedKeys(skillMap).map((skill) => (
          <div key={skill} className="col d-flex gap-2 small">
            <span className="flex-grow-1">{skillMap[skill]}</span>
            <CheckField label="влад." path={`skills.${skill}.proficiency`} value={draft.skills[skill].proficiency} set={set}/>
            <CheckField label="комп." path={`skills.${skill}.expertise`} value={draft.skills[skill].expertise} set={set}/>
          </div>
        ))}
      </div>
      <div className="mt-2"><CheckField label="Владение инициативой" path="initiative.proficiency" value={draft.initiative.proficiency} set={set}/></div>
    </Section>
  )
}

export function ProficienciesSection({draft, set, options}: SectionProps) {
  const groups = [
    ['Доспехи', 'proficiencies.armorProficiencies', draft.proficiencies.armorProficiencies, options.armor],
    ['Оружие', 'proficiencies.weaponProficiencies', draft.proficiencies.weaponProficiencies, options.weapons],
    ['Инструменты', 'proficiencies.toolProficiencies', draft.proficiencies.toolProficiencies, options.tools],
    ['Языки', 'proficiencies.languageProficiencies', draft.proficiencies.languageProficiencies, options.languages],
    ['Сопротивление', 'resistances', draft.resistances, options.damageTypes],
    ['Иммунитет', 'immunities', draft.immunities, options.damageTypes],
    ['Иммунитет к состояниям', 'conditionImmunities', draft.conditionImmunities, options.conditions]
  ] as const
  const digest = groups.filter(([, , values]) => values.length > 0).map(([title, , values]) => `${title.toLowerCase()}: ${values.length}`).join(' · ') || 'нет'

  return (
    <Section title="Владения и защита" digest={digest}>
      {groups.map(([title, path, values, groupOptions]) => <ChipPick key={path} title={title} path={path} values={[...values]} options={groupOptions} set={set}/>)}
    </Section>
  )
}

export function FeaturesSection({draft, set, options}: SectionProps) {
  return (
    <Section title="Умения и черты" digest={`всего: ${draft.features.length}`}>
      <div className="d-flex flex-wrap gap-1">
        {draft.features.map((instance, index) => {
          const name = options.names[instance.featureId] ?? instance.featureId
          return (
            <span key={`${instance.featureId}-${index}`} className="tb-chip pe-0">
              {name}<Remove label={`Убрать: ${name}`} onClick={() => set('features', draft.features.filter((_, position) => position !== index))}/>
            </span>
          )
        })}
      </div>
      <p className="small text-muted mb-0 mt-2">Новые умения добавляет помощник создания и повышения уровня.</p>
    </Section>
  )
}

//human-owned formula text the engine evaluates; {character.…} paths, @level() / @startingHitDie() and @armor(unarmored) / @shield() are allowed
export function FormulasSection({draft, set}: SectionProps) {
  return (
    <Section title="Формулы" digest="КД, хиты, модификаторы, навыки — правятся редко">
      <div className="tb-eyebrow mb-1">Основные</div>
      <div className="row row-cols-1 row-cols-sm-2 g-1 mb-2">
        <div className="col"><InlineField label="КД" path="armorClass" value={draft.armorClass} set={set}/></div>
        <div className="col"><InlineField label="Макс. хиты" path="hitPoints.max" value={draft.hitPoints.max} set={set}/></div>
        <div className="col"><InlineField label="Бонус мастерства" path="proficiency" value={draft.proficiency} set={set}/></div>
        <div className="col"><InlineField label="Инициатива" path="initiative.value" value={draft.initiative.value} set={set}/></div>
        <div className="col"><InlineField label="Пасс. восприятие" path="passivePerception" value={draft.passivePerception} set={set}/></div>
        <div className="col"><InlineField label="Макс. настроек" path="maxAttunements" value={draft.maxAttunements} set={set}/></div>
        <div className="col"><InlineField label="Спасбр. от смерти" path="deathSavingThrows.value" value={draft.deathSavingThrows.value} set={set}/></div>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <div className="tb-num-field tb-num-field--wide"><NumberField label="Бонус СЛ заклинаний" path="spellcasting.dcBonus" value={draft.spellcasting.dcBonus} set={set} required/></div>
        <div className="tb-num-field tb-num-field--wide"><NumberField label="Бонус атаки заклинаниями" path="spellcasting.attackBonus" value={draft.spellcasting.attackBonus} set={set} required/></div>
      </div>
      <details className="tb-section">
        <summary><span className="tb-eyebrow">Модификаторы и спасброски</span></summary>
        <div className="row row-cols-1 row-cols-sm-2 g-1 mb-2">
          {typedKeys(attributeMap).flatMap((attribute) => [
            <div key={`${attribute}-modifier`} className="col"><InlineField label={`Мод. ${attributeShort(attribute)}`} path={`attributes.${attribute}.modifier`} value={draft.attributes[attribute].modifier} set={set}/></div>,
            <div key={`${attribute}-save`} className="col"><InlineField label={`Спасбр. ${attributeShort(attribute)}`} path={`savingThrows.${attribute}.value`} value={draft.savingThrows[attribute].value} set={set}/></div>
          ])}
        </div>
      </details>
      <details className="tb-section">
        <summary><span className="tb-eyebrow">Навыки</span></summary>
        <div className="row row-cols-1 row-cols-sm-2 g-1">
          {typedKeys(skillMap).map((skill) => <div key={skill} className="col"><InlineField label={skillMap[skill]} path={`skills.${skill}.value`} value={draft.skills[skill].value} set={set}/></div>)}
        </div>
      </details>
    </Section>
  )
}
