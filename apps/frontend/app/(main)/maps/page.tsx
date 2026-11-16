//DM: the map library — campaign-free maps every DM shares. Upload one, or snapshot a campaign map in («В библиотеку» on its row);
//a campaign takes a copy through «Из библиотеки». Players never see this page.
import Link from "next/link"
import {requireAdmin} from "@frontend/_util/session"
import {listLibrary} from "@frontend/actions/maps"
import LibraryCard from "@frontend/components/Map/LibraryCard"
import {LibraryDelete} from "@frontend/components/Map/LibraryButtons"

export default async function MapLibraryPage() {
  await requireAdmin()
  const {data: maps, message} = await listLibrary()

  return (
    <div className="container">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Библиотека карт</h1>
        <Link href="/maps/new" className="btn btn-sm btn-primary">Новая карта</Link>
      </div>
      <p className="small text-muted">Общие для всех ГМ. Кампания берёт копию со всеми монстрами и дальше правит её сама — библиотека от этого не меняется.</p>
      {!maps && <div className="alert alert-danger">{message}</div>}
      <div className="row g-3">
        {maps?.map((map) => (
          <LibraryCard key={String(map._id)} map={map} href={`/maps/${map._id}`}><LibraryDelete mapId={String(map._id)}/></LibraryCard>
        ))}
        {maps?.length === 0 && <div className="tb-empty">Библиотека пуста. Загрузите карту здесь или нажмите «В библиотеку» у карты кампании.</div>}
      </div>
    </div>
  )
}
