//One campaign: description and its characters for everyone in it; for the DM also the maps and the settings; the room dock (DM: request inbox).
//Players see no maps here — neither the ones ahead nor the unfogged picture of the current one; the game room shows where they are.
import Link from "next/link"
import {requireUser} from "@frontend/_util/session"
import {getCampaign, listUsers} from "@frontend/actions/campaigns"
import {listCharacters} from "@frontend/actions/characters"
import {className, raceName} from "@frontend/_util/rulebook"
import CampaignForm from "@frontend/components/Campaign/CampaignForm"
import RoomProvider from "@frontend/components/Room/RoomProvider"
import RoomDock from "@frontend/components/Room/RoomDock"
import MapsBlock from "@frontend/components/Map/MapsBlock"
import Fold from "@frontend/components/UI/Fold"
import {listMaps} from "@frontend/actions/maps"

export default async function CampaignPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const user = await requireUser()
  const isDM = user.role === 'ГМ'
  const [{data: campaign, message}, {data: characters}, {data: users}, {data: maps}] = await Promise.all([
    getCampaign(id), listCharacters(id), isDM ? listUsers() : Promise.resolve({data: null}), isDM ? listMaps(id) : Promise.resolve({data: null})
  ])
  if (!campaign) return <div className="container"><div className="alert alert-danger">{message}</div></div>
  const party = characters ?? []                                                                                        //the backend leaves templates and copies out (game room only)

  return (
    <RoomProvider campaignId={id} user={{id: String(user._id), username: user.username, role: user.role}} refreshOnUpdate={false}>
      <div className="container">
        <div className="d-flex align-items-center gap-3 mb-3">
          {campaign.image && <img src={campaign.image} alt="" width={96} height={64} className="rounded object-fit-cover"/>}
          <div>
            <h1 className="h3 mb-0">{campaign.name}</h1>
            <div className="text-muted small">{campaign.status}</div>
          </div>
          <Link href={`/play/${id}`} className="btn btn-primary ms-auto">Войти в игру</Link>
        </div>
        {campaign.description && <p className="description">{campaign.description}</p>}

        <div className="card bg-dark mb-3">
          <div className="card-header fw-bold text-primary d-flex justify-content-between">
            <span>Персонажи</span>
            <Link href="/characters" className="small">Создать персонажа</Link>
          </div>
          <ul className="list-group list-group-flush">
            {party.map((character) => (
              <li key={String(character._id)} className="list-group-item bg-dark">
                <Link href={`/characters/${character._id}`}>{character.name === 'not_init' ? 'Новый персонаж' : character.name}</Link>
                <span className="small text-muted ms-2">
                  {[character.race && raceName(character.race), character.classes.map((entry) => `${className(entry.class)} ${entry.level}`).join(' / ')].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
            {party.length === 0 && <li className="list-group-item bg-dark text-muted">Пока нет персонажей.</li>}
          </ul>
        </div>

        {isDM && <MapsBlock campaignId={id} maps={maps ?? []} currentMap={campaign.currentMap ? String(campaign.currentMap) : null}/>}

        {isDM && (
          <Fold title="Настройки кампании (ГМ)" digest={`${campaign.status} · игроков: ${campaign.players.length}`}>
            <CampaignForm id={id} users={(users ?? []).map((entry) => ({id: String(entry._id), username: entry.username, role: entry.role}))}
                          initial={{name: campaign.name, description: campaign.description, status: campaign.status, players: campaign.players.map(String), image: campaign.image}}/>
          </Fold>
        )}
      </div>
      <RoomDock/>
    </RoomProvider>
  )
}
