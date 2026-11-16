//DM: pick a library map for this campaign — it arrives as the campaign's own copy, monsters placed as copies of its templates.
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import {getCampaign} from "@frontend/actions/campaigns"
import {listLibrary} from "@frontend/actions/maps"
import LibraryCard from "@frontend/components/Map/LibraryCard"
import {ImportButton} from "@frontend/components/Map/LibraryButtons"

export default async function ImportMapPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  await requireAdmin()
  const [{data: campaign, message}, {data: maps, message: libraryMessage}] = await Promise.all([getCampaign(id), listLibrary()])
  if (!campaign) return <div className="container"><div className="alert alert-danger">{message}</div></div>

  return (
    <div className="container">
      <Link href={`/campaigns/${id}`} className="small">← {campaign.name}</Link>
      <h1 className="h3 mb-3">Карта из библиотеки</h1>
      {!maps && <div className="alert alert-danger">{libraryMessage}</div>}
      <div className="row g-3">
        {maps?.map((map) => (
          <LibraryCard key={String(map._id)} map={map}><ImportButton libraryId={String(map._id)} campaignId={id}/></LibraryCard>
        ))}
        {maps?.length === 0 && <div className="tb-empty">Библиотека пуста. Сохраните туда карту кнопкой «В библиотеку» или загрузите на странице <Link href="/maps">Карты</Link>.</div>}
      </div>
    </div>
  )
}
