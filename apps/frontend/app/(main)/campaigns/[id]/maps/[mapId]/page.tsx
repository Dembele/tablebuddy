//DM: edit one map (name, description, image, grid).
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import {getMap} from "@frontend/actions/maps"
import MapForm from "@frontend/components/Map/MapForm"

export default async function EditMapPage({params}: { params: Promise<{ id: string; mapId: string }> }) {
  const {id, mapId} = await params
  await requireAdmin()
  const {data: map, message} = await getMap(mapId)
  if (!map) return <div className="container"><div className="alert alert-danger">{message}</div></div>

  return (
    <div className="container">
      <Link href={`/campaigns/${id}`} className="small">← к кампании</Link>
      <h1 className="h3 mb-3">{map.name}</h1>
      <MapForm campaignId={id} id={mapId}
               initial={{name: map.name, description: map.description, gridType: map.gridType, gridConfig: map.gridConfig, backgroundImagePath: map.backgroundImagePath, fogEnabled: !!map.fogOfWar?.enabled}}/>
    </div>
  )
}
