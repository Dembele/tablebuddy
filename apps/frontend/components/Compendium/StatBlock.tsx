//A printed monster stat block (data/monsters), server-rendered: compendium page and stat-block character sheets.
//`withNumbers = false` leaves out what a live sheet already shows (AC, HP, scores…) and keeps the text parts.
import Link from "next/link"
import {ReactNode} from "react"
import {Monster, MonsterEntry, MonsterLore} from "@frontend/deps/types/book/monsters"
import {attributeMap, ENAttribute} from "@frontend/deps/types/Attribute"
import {skillMap} from "@frontend/deps/types/Skill"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {conditionMap} from "@frontend/deps/types/Condition"
import {creatureTypeMap, sizeMap} from "@frontend/deps/types/Race"
import {itemById, spellById} from "@frontend/_util/compendium"

const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`
const short: Record<ENAttribute, string> = {strength: 'СИЛ', dexterity: 'ЛОВ', constitution: 'ТЕЛ', intelligence: 'ИНТ', wisdom: 'МДР', charisma: 'ХАР'}
const capital = (text: string) => text ? text[0].toUpperCase() + text.slice(1) : text
const speedLabels: Array<[keyof Monster['speed'], string]> = [['walk', ''], ['fly', 'полёт'], ['climb', 'лазание'], ['swim', 'плавание'], ['burrow', 'копание']]
const senseLabels: Array<[keyof Monster['senses'], string]> = [['darkvision', 'тёмное зрение'], ['blindsight', 'слепое зрение'], ['truesight', 'истинное зрение'], ['tremorsense', 'чувство вибрации']]

//the line under the name: «Маленький Фея (Гоблиноид), Хаотичная Нейтральная»
export function monsterLine(monster: Monster): string {
  const sizes = monster.size.map((size) => capital(sizeMap[size])).join(' или ')
  const type = [creatureTypeMap[monster.type], monster.altType && creatureTypeMap[monster.altType]].filter(Boolean).join(' или ')
  const swarm = monster.swarmOf ? `рой (${typeof monster.swarmOf === 'string' && monster.swarmOf in sizeMap ? sizeMap[monster.swarmOf as keyof typeof sizeMap] : monster.swarmOf}) ` : ''
  return `${sizes} ${swarm}${type}${monster.tags?.length ? ` (${monster.tags.join(', ')})` : ''}, ${monster.alignment}`
}

const speedText = (speed: Monster['speed']) => [
  ...speedLabels.filter(([key]) => typeof speed[key] === 'number').map(([key, label]) => `${label ? `${label} ` : ''}${speed[key]} фт.${key === 'fly' && speed.hover ? ' (парит)' : ''}`),
  ...(speed.note ? [speed.note] : [])
].join(', ')

function Row({label, children}: { label: string; children: ReactNode }) {
  return <div><b>{label}</b> {children}</div>
}

function Entries({title, entries, intro}: { title: string; entries?: MonsterEntry[]; intro?: string }) {
  if (!entries?.length) return null
  return (
    <section className="mt-3">
      <h3 className="h6 border-bottom border-danger-subtle pb-1 text-danger-emphasis">{title}</h3>
      {intro && <p className="description small text-muted">{intro}</p>}
      {entries.map((entry) => (
        <div key={entry.id} className="mb-2 small">
          <b><i>{entry.name}</i></b>
          {entry.usage && <span className="text-muted"> ({entry.usage})</span>}
          {entry.note && <span className="text-muted"> ({entry.note})</span>}
          <span className="description">. {entry.trigger ? <><i>Условие:</i> {entry.trigger} </> : null}{entry.description}</span>
          {entry.spells?.length ? (
            <div className="text-muted">Заклинания: {entry.spells.map((spell, index) => (
              <span key={spell}>{index ? ', ' : ''}<Link href={`/compendium/spells/${spell}`}>{spellById(spell)?.name ?? spell}</Link></span>
            ))}</div>
          ) : null}
        </div>
      ))}
    </section>
  )
}

function Lore({blocks}: { blocks: MonsterLore[] }) {
  return (
    <section className="mt-4 small">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'header': return block.level <= 3 ? <h3 key={index} className="h6 mt-3">{block.text}</h3> : <h4 key={index} className="h6 mt-2 text-muted">{block.text}</h4>
          case 'paragraph': return <p key={index} className={`description ${block.italic ? 'fst-italic text-muted' : ''}`}>{block.text}</p>
          case 'list': return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex} className="description">{item}</li>)}</ul>
          case 'quote': return <blockquote key={index} className="border-start ps-2 fst-italic text-muted description">{block.text}</blockquote>
          case 'sidebar': return <div key={index} className="border rounded p-2 mb-2">{block.title && <b>{block.title}</b>}<div className="description">{block.text}</div></div>
          case 'rule': return <hr key={index}/>
          case 'table': return (
            <div key={index} className="table-responsive">
              <table className="table table-dark table-sm table-bordered small w-auto">
                <tbody>{block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          )
        }
      })}
    </section>
  )
}

export default function StatBlock({monster, withNumbers = true, withLore = true}: { monster: Monster; withNumbers?: boolean; withLore?: boolean }) {
  const modifier = (attribute: ENAttribute) => Math.floor((monster.abilities[attribute] - 10) / 2)
  const damageNames = (list?: string[]) => list?.map((type) => damageTypeMap[type as keyof typeof damageTypeMap] ?? type).join(', ')
  const senses = [
    ...senseLabels.filter(([key]) => typeof monster.senses[key] === 'number').map(([key, label]) => `${label} ${monster.senses[key]} фт.`),
    ...(monster.senses.note ? [monster.senses.note] : []),
    ...(monster.senses.passivePerception !== undefined ? [`пассивное Восприятие ${monster.senses.passivePerception}`] : [])
  ].join(', ')

  return (
    <div>
      <div className="small d-flex flex-column gap-1">
        {withNumbers && (
          <>
            <Row label="Класс Защиты">{monster.armorClass}{monster.armorNote ? ` (${monster.armorNote})` : ''} <b className="ms-2">Инициатива</b> {signed(monster.initiative)}</Row>
            <Row label="Хиты">{monster.hitPoints.average} ({monster.hitPoints.formula.replace(/d/g, 'к')})</Row>
            <Row label="Скорость">{speedText(monster.speed)}</Row>
            <div className="table-responsive">
              <table className="table table-dark table-sm text-center small w-auto mb-1">
                <thead><tr><th/>{(Object.keys(short) as ENAttribute[]).map((attribute) => <th key={attribute} title={attributeMap[attribute]}>{short[attribute]}</th>)}</tr></thead>
                <tbody>
                  <tr><td className="text-muted">значение</td>{(Object.keys(short) as ENAttribute[]).map((attribute) => <td key={attribute}>{monster.abilities[attribute]}</td>)}</tr>
                  <tr><td className="text-muted">мод.</td>{(Object.keys(short) as ENAttribute[]).map((attribute) => <td key={attribute}>{signed(modifier(attribute))}</td>)}</tr>
                  <tr><td className="text-muted">спас.</td>{(Object.keys(short) as ENAttribute[]).map((attribute) => (
                    <td key={attribute} className={monster.saves?.[attribute] !== undefined ? 'text-primary fw-bold' : ''}>{signed(monster.saves?.[attribute] ?? modifier(attribute))}</td>
                  ))}</tr>
                </tbody>
              </table>
            </div>
            {monster.skills && <Row label="Навыки">{Object.entries(monster.skills).map(([skill, bonus]) => `${skillMap[skill as keyof typeof skillMap]} ${signed(bonus!)}`).join(', ')}</Row>}
          </>
        )}
        {monster.vulnerabilities && <Row label="Уязвимости">{damageNames(monster.vulnerabilities)}</Row>}
        {monster.resistances && <Row label="Сопротивления">{damageNames(monster.resistances)}</Row>}
        {monster.immunities && (
          <Row label="Иммунитеты">{[damageNames(monster.immunities.damage), monster.immunities.conditions.map((condition) => conditionMap[condition]).join(', ')].filter(Boolean).join('; ')}</Row>
        )}
        {monster.damageNote && <Row label="Особо">{monster.damageNote}</Row>}
        {senses && <Row label="Чувства">{senses}</Row>}
        <Row label="Языки">{monster.languages}</Row>
        <Row label="Опасность">{monster.challenge.rating} ({monster.challenge.xp.toLocaleString('ru')} опыта{monster.challenge.xpInLair ? ` или ${monster.challenge.xpInLair.toLocaleString('ru')} в логове` : ''}; БВ +{monster.challenge.proficiency})</Row>
        {monster.habitat && <Row label="Среда обитания">{monster.habitat.join(', ')}</Row>}
        {monster.treasure && <Row label="Сокровища">{monster.treasure.join(', ')}</Row>}
        {monster.gear && (
          <Row label="Снаряжение">{monster.gear.map((gear, index) => (
            <span key={index}>{index ? ', ' : ''}{'item' in gear ? <Link href={`/compendium/items/${gear.item}`}>{itemById(gear.item)?.name ?? gear.item}</Link> : gear.name}{gear.quantity ? ` ×${gear.quantity}` : ''}</span>
          ))}</Row>
        )}
      </div>
      <Entries title="Особенности" entries={monster.traits}/>
      <Entries title="Действия" entries={monster.actions}/>
      <Entries title="Бонусные действия" entries={monster.bonusActions}/>
      <Entries title="Реакции" entries={monster.reactions}/>
      <Entries title="Легендарные действия" entries={monster.legendaryActions} intro={monster.legendaryIntro}/>
      {withLore && monster.lore && <Lore blocks={monster.lore}/>}
    </div>
  )
}
