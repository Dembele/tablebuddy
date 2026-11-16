//DM: edit a library map (name, description, image, grid, fog switch); its monster placements are shown, set by the snapshot.
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import {getMap} from "@frontend/actions/maps"
import MapForm from "@frontend/components/Map/MapForm"
import {placementDigest} from "@frontend/components/Map/LibraryCard"

export default async function EditLibraryMapPage({params}: { params: Promise<{ mapId: string }> }) {
  const {mapId} = await params
  await requireAdmin()
  const {data: map, message} = await getMap(mapId)
  if (!map || !map.isTemplate || map.campaign) return <div className="container"><div className="alert alert-danger">{map ? 'Это карта кампании, не библиотеки' : message}</div></div>
  const monstersPlaced = placementDigest(map.placements)

  return (
    <div className="container">
      <Link href="/maps" className="small">← Библиотека карт</Link>
      <h1 className="h3 mb-1">{map.name}</h1>
      <p className="small text-muted">{monstersPlaced ? `Монстры при импорте: ${monstersPlaced}.` : 'Без монстров.'} Расставить других — в кампании, затем снова «В библиотеку».</p>
      <MapForm id={mapId}
               initial={{name: map.name, description: map.description, gridType: map.gridType, gridConfig: map.gridConfig, backgroundImagePath: map.backgroundImagePath, fogEnabled: !!map.fogOfWar?.enabled}}/>
    </div>
  )
}
