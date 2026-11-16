//DM: new map for a campaign.
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import {getCampaign} from "@frontend/actions/campaigns"
import MapForm from "@frontend/components/Map/MapForm"

export default async function NewMapPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  await requireAdmin()
  const {data: campaign, message} = await getCampaign(id)
  if (!campaign) return <div className="container"><div className="alert alert-danger">{message}</div></div>

  return (
    <div className="container">
      <Link href={`/campaigns/${id}`} className="small">← {campaign.name}</Link>
      <h1 className="h3 mb-3">Новая карта</h1>
      <MapForm campaignId={id}/>
    </div>
  )
}
