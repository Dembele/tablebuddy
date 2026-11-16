//Campaigns: the DM sees all and can create; a player sees the ones they play in.
import Link from "next/link"
import {listCampaignEntries} from "@frontend/actions/campaigns"
import {requireUser} from "@frontend/_util/session"

export default async function CampaignsPage() {
  const [user, {data: campaigns, message}] = await Promise.all([requireUser(), listCampaignEntries()])
  const isDM = user.role === 'ГМ'

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Кампании</h1>
        {isDM && <Link href="/campaigns/new" className="btn btn-primary">Новая кампания</Link>}
      </div>
      {!campaigns && <div className="alert alert-danger">{message}</div>}
      <div className="row g-3">
        {(campaigns ?? []).map((campaign) => (
          <div key={String(campaign._id)} className="col-md-6 col-lg-4">
            <Link href={`/campaigns/${campaign._id}`} className="card h-100 bg-dark text-decoration-none">
              {campaign.image && <img src={campaign.image} alt="" className="card-img-top object-fit-cover" style={{height: 160}}/>}
              <div className="card-body">
                <h2 className="h5 card-title text-primary">{campaign.name}</h2>
                <p className="card-text small text-muted mb-0">{campaign.status} · игроков: {campaign.players.length}</p>
              </div>
            </Link>
          </div>
        ))}
        {campaigns?.length === 0 && <p className="text-muted">{isDM ? 'Кампаний пока нет — создайте первую.' : 'Вас пока не добавили ни в одну кампанию.'}</p>}
      </div>
    </div>
  )
}
