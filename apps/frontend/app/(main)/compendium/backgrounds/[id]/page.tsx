//Compendium: one background — ability options, origin feat (with text), proficiencies, starting kits.
import Link from "next/link"
import {notFound} from "next/navigation"
import {ReactNode} from "react"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import {backgroundById, equipmentText, featureById, proficienciesText} from "@frontend/_util/compendium"
import {nameOf} from "@frontend/deps/builder/options"
import {attributeMap} from "@frontend/deps/types/Attribute"

export default async function BackgroundPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const background = backgroundById(id)
  if (!background) notFound()

  const {options} = background.abilityScores
  const feat = featureById(background.feat.feature)
  const meta: Array<[string, ReactNode]> = [
    ['Характеристики', `${options === 'any' ? 'любые' : options.map((attribute) => attributeMap[attribute]).join(', ')} (+2/+1 или +1/+1/+1)`],
    ['Черта', <Link key="feat" href={`/compendium/features/${background.feat.feature}`}>{feat?.name ?? background.feat.feature}</Link>]
  ]
  const skills = proficienciesText(background.grants.skillProficiencies, nameOf.skill)
  const tools = proficienciesText(background.grants.toolProficiencies, nameOf.tool)
  if (skills) meta.push(['Навыки', skills])
  if (tools) meta.push(['Инструменты', tools])

  return (
    <EntryPage section="backgrounds" title={background.name} meta={meta} description={background.description}>
      <div className="small mb-3">
        <div className="text-muted mb-1">Начальное снаряжение</div>
        {background.equipment.map((option, index) => <div key={index}>{'АБВ'[index]}: {equipmentText(option)}</div>)}
      </div>
      {feat?.description && (
        <>
          <h2 className="h5">{feat.name}</h2>
          <div className="description small">{feat.description}</div>
        </>
      )}
    </EntryPage>
  )
}
