//Повышение уровня: builder walk planned on the server from the stored character, answered in the wizard.
import Link from "next/link"
import {getRawCharacter} from "@frontend/actions/characters"
import {planBuild} from "@frontend/actions/builder"
import BuilderWizard from "@frontend/components/Character/builder/BuilderWizard"
import {requireUser} from "@frontend/_util/session"

export default async function Page({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const [user, {data: character, message}] = await Promise.all([requireUser(), getRawCharacter(id)])
  if (!character) return <div className="container"><div className="alert alert-danger">{message}</div></div>
  if (character.classes.length === 0) return <div className="container"><div className="alert alert-info">Сначала создайте персонажа. <Link href={`/characters/${id}`}>К листу</Link></div></div>

  if (user.role !== 'ГМ' && !character.levelUpAllowed) return <div className="container"><div className="alert alert-info">Повышение уровня пока не разрешено ГМ. <Link href={`/characters/${id}`}>К листу</Link></div></div>

  const plan = await planBuild('levelUp', character, {})
  return (
    <div className="container">
      <h1 className="h3 mb-3">Повышение уровня</h1>
      <BuilderWizard mode="levelUp" id={id} base={character} initialPlan={plan}/>
    </div>
  )
}
