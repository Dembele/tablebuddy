//Создание персонажа: builder walk planned on the server from the stored character, answered in the wizard.
import Link from "next/link"
import {getRawCharacter} from "@frontend/actions/characters"
import {planBuild} from "@frontend/actions/builder"
import BuilderWizard from "@frontend/components/Character/builder/BuilderWizard"

export default async function Page({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const {data: character, message} = await getRawCharacter(id)
  if (!character) return <div className="container"><div className="alert alert-danger">{message}</div></div>
  if (character.classes.length > 0) return <div className="container"><div className="alert alert-info">У персонажа уже есть класс — используйте повышение уровня. <Link href={`/characters/${id}`}>К листу</Link></div></div>

  const plan = await planBuild('creation', character, {})
  return (
    <div className="container">
      <h1 className="h3 mb-3">Создание персонажа</h1>
      <BuilderWizard mode="creation" id={id} base={character} initialPlan={plan}/>
    </div>
  )
}
