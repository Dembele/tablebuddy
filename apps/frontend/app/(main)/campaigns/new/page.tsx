//New campaign (DM only).
import {redirect} from "next/navigation"
import {requireUser} from "@frontend/_util/session"
import {listUsers} from "@frontend/actions/campaigns"
import CampaignForm from "@frontend/components/Campaign/CampaignForm"

export default async function NewCampaignPage() {
  const user = await requireUser()
  if (user.role !== 'ГМ') redirect('/campaigns')
  const {data: users} = await listUsers()

  return (
    <div className="container">
      <h1 className="h3 mb-3">Новая кампания</h1>
      <CampaignForm users={(users ?? []).map((entry) => ({id: String(entry._id), username: entry.username, role: entry.role}))}/>
    </div>
  )
}
