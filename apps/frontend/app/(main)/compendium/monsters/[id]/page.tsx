//Compendium: one monster's stat block; the DM adds it to a campaign as a template and makes its round token (the pack).
import {notFound} from "next/navigation"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import StatBlock, {monsterLine} from "@frontend/components/Compendium/StatBlock"
import AddMonster, {RemoveMonsterToken} from "@frontend/components/Compendium/AddMonster"
import TokenMaker from "@frontend/components/Character/TokenMaker"
import {getMonsterToken} from "@frontend/actions/monsters"
import {monsterById, param} from "@frontend/_util/compendium"
import {requireUser} from "@frontend/_util/session"
import {listCampaigns} from "@frontend/actions/characters"

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function MonsterPage({params, searchParams}: { params: Promise<{ id: string }>; searchParams: Search }) {
  const [{id}, search, user] = await Promise.all([params, searchParams, requireUser()])
  const monster = monsterById(id)
  if (!monster) notFound()
  const isDM = user.role === 'ГМ'
  const [campaignList, token] = isDM ? await Promise.all([listCampaigns(), getMonsterToken(monster.id)]) : [null, null]
  const campaigns = (campaignList?.data ?? []).map((campaign) => ({id: String(campaign._id), name: campaign.name}))
  const pack = token?.data ?? null

  return (
    <EntryPage section="monsters" title={monster.name} subtitle={monsterLine(monster)}>
      {isDM && <div className="mb-3"><AddMonster monster={monster.id} campaigns={campaigns} preselected={param(search.campaign)}/></div>}
      <div className="row g-3">
        <div className={isDM ? 'col-lg-8' : 'col-12'}><StatBlock monster={monster}/></div>
        {isDM && (
          <div className="col-lg-4">
            <div className="card bg-dark">
              <div className="card-header fw-bold text-primary d-flex justify-content-between align-items-center">
                <span>Токен монстра</span>{pack && <RemoveMonsterToken monster={monster.id}/>}
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Новые шаблоны этого монстра получат этот токен.</div>
                <TokenMaker monsterId={monster.id} storedImage={pack?.image} currentAvatar={pack?.avatar}/>
              </div>
            </div>
          </div>
        )}
      </div>
    </EntryPage>
  )
}
