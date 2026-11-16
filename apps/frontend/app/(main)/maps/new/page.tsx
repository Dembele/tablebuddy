//DM: a new library map from an image (no campaign, no monsters — those come with a snapshot of a campaign map).
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import MapForm from "@frontend/components/Map/MapForm"

export default async function NewLibraryMapPage() {
  await requireAdmin()
  return (
    <div className="container">
      <Link href="/maps" className="small">← Библиотека карт</Link>
      <h1 className="h3 mb-3">Новая карта в библиотеке</h1>
      <MapForm/>
    </div>
  )
}
