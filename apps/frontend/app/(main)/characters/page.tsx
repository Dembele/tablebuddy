//Characters the user can open (DM: all), grouped by campaign, plus a create form.
import Link from "next/link"
import {listCampaigns, listCharacters} from "@frontend/actions/characters"
import {backgroundName, className, raceName} from "@frontend/_util/rulebook"
import CreateCharacterForm from "@frontend/app/(main)/characters/page.client"

export default async function CharactersPage() {
  const [{data: characters, message}, {data: campaigns, message: campaignsMessage}] = await Promise.all([listCharacters(), listCampaigns()])
  const campaignName = new Map((campaigns ?? []).map((campaign) => [String(campaign._id), campaign.name]))

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Персонажи</h1>
      </div>
      {!characters && <div className="alert alert-danger">{message}</div>}

      <div className="row g-3">
        {(characters ?? []).map((character) => {
          const level = character.classes.reduce((total, entry) => total + entry.level, 0)
          const classLine = character.classes.map((entry) => `${className(entry.class)} ${entry.level}`).join(' / ')
          return (
            <div key={String(character._id)} className="col-md-6 col-lg-4">
              <Link href={`/characters/${character._id}`} className="card h-100 bg-dark text-decoration-none">
                <div className="card-body">
                  <h2 className="h5 card-title text-primary">{character.name === 'not_init' ? 'Новый персонаж' : character.name}</h2>
                  <p className="card-text mb-1">{[character.race && raceName(character.race), character.background && backgroundName(character.background)].filter(Boolean).join(' · ') || 'Происхождение не выбрано'}</p>
                  <p className="card-text small text-muted mb-0">{classLine || 'Без класса'}{level ? ` · ур. ${level}` : ''}</p>
                </div>
                <div className="card-footer small text-muted">{campaignName.get(String(character.campaign)) ?? 'Кампания'}</div>
              </Link>
            </div>
          )
        })}
        {characters?.length === 0 && <p className="text-muted">Пока нет ни одного персонажа.</p>}
      </div>

      <div className="card bg-dark mt-4">
        <div className="card-body">
          <h2 className="h5">Новый персонаж</h2>
          <CreateCharacterForm campaigns={(campaigns ?? []).map((campaign) => ({id: String(campaign._id), name: campaign.name}))}
                               campaignsError={campaigns ? undefined : campaignsMessage}/>
        </div>
      </div>
    </div>
  )
}
