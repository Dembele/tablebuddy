//Compendium: one class — basics, proficiencies, starting kits, the level table, features by level, subclasses.
import Link from "next/link"
import {notFound} from "next/navigation"
import {ReactNode} from "react"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import FeatureTimeline from "@frontend/components/Compendium/FeatureTimeline"
import {allSubclasses, classById, equipmentText, featureById, proficienciesText, proficiencyAt} from "@frontend/_util/compendium"
import {nameOf} from "@frontend/deps/builder/options"
import {attributeMap} from "@frontend/deps/types/Attribute"

export default async function ClassPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const entry = classById(id)
  if (!entry) notFound()

  const {grants} = entry
  const meta: Array<[string, ReactNode]> = [
    ['Кость хитов', `к${entry.hitDie}`],
    ['Основная характеристика', entry.primaryAbility.attributes.map((attribute) => attributeMap[attribute]).join(entry.primaryAbility.mode === 'all' ? ' и ' : ' или ')],
    ['Спасброски', entry.savingThrows.map((attribute) => attributeMap[attribute]).join(', ')]
  ]
  const lines: Array<[string, string | null]> = [
    ['Навыки', proficienciesText(grants.skillProficiencies, nameOf.skill)],
    ['Оружие', proficienciesText(grants.weaponProficiencies, nameOf.weaponType)],
    ['Доспехи', proficienciesText(grants.armorProficiencies, nameOf.armor)],
    ['Инструменты', proficienciesText(grants.toolProficiencies, nameOf.tool)]
  ]
  for (const [label, text] of lines) if (text) meta.push([label, text])
  if (entry.spellcasting) meta.push(['Заклинательная характеристика', attributeMap[entry.spellcasting.ability]])

  const columns = Object.values(entry.table)
  const levels = Array.from({length: 20}, (_, index) => index + 1)
  const featuresAt = (level: number) => [
    ...entry.features.filter((grant) => grant.level === level).map((grant) => featureById(grant.feature)?.name ?? grant.feature),
    ...(entry.subclassLevels.includes(level) ? ['Умение подкласса'] : [])
  ]

  return (
    <EntryPage section="classes" title={entry.name} meta={meta} description={entry.description}>
      <div className="small mb-3">
        <div className="text-muted mb-1">Начальное снаряжение</div>
        {entry.equipment.map((option, index) => <div key={index}>{'АБВ'[index]}: {equipmentText(option)}</div>)}
      </div>

      <div className="table-responsive mb-3">
        <table className="table table-dark table-sm table-striped small align-middle">
          <thead>
            <tr><th>Ур.</th><th>БМ</th><th>Умения</th>{columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level}>
                <td>{level}</td><td>+{proficiencyAt(level)}</td><td>{featuresAt(level).join(', ') || '—'}</td>
                {columns.map((column) => <td key={column.name}>{column.values[level - 1] || '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h5">Подклассы</h2>
      <div className="mb-3">
        {allSubclasses.filter((subclass) => subclass.class === entry.id).map((subclass) => (
          <Link key={subclass.id} href={`/compendium/subclasses/${subclass.id}`} className="btn btn-sm btn-outline-primary me-2 mb-2">{subclass.name}</Link>
        ))}
      </div>

      <h2 className="h5">Умения</h2>
      <FeatureTimeline grants={entry.features}/>
    </EntryPage>
  )
}
