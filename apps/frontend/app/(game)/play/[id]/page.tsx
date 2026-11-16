//Game room page: full screen, no site header; members and the DM only (the campaign read checks it).
import Link from "next/link"
import {requireUser} from "@frontend/_util/session"
import {getCampaign} from "@frontend/actions/campaigns"
import {listMaps} from "@frontend/actions/maps"
import GameRoom from "@frontend/components/Game/GameRoom"
import {allMonsters} from "@frontend/_util/compendium"

export default async function PlayPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const user = await requireUser(`/play/${id}`)
  const isDM = user.role === 'ГМ'
  const [{data: campaign, message}, {data: maps}] = await Promise.all([getCampaign(id), isDM ? listMaps(id) : Promise.resolve({data: null})])
  if (!campaign) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">{message}</div>
        <Link href="/campaigns">К кампаниям</Link>
      </div>
    )
  }

  return (
    <GameRoom campaign={{id, name: campaign.name}} user={{id: String(user._id), username: user.username, role: user.role}}
              maps={(maps ?? []).map((map) => ({id: String(map._id), name: map.name}))}
              monsters={isDM ? allMonsters.map((monster) => ({id: monster.id, name: monster.name, rating: monster.challenge.rating, type: monster.type})) : []}/>
  )
}
