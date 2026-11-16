//Campaign maps (DM only — players never get the list): thumbnails, the current one marked; create, edit, make current, delete.
import Link from "next/link"
import {MapSummary} from "@frontend/actions/maps"
import MapButtons from "@frontend/components/Map/MapButtons"

export default function MapsBlock({campaignId, maps, currentMap}: { campaignId: string; maps: MapSummary[]; currentMap: string | null }) {
  return (
    <div className="card bg-dark mb-3">
      <div className="card-header fw-bold text-primary d-flex justify-content-between align-items-center">
        <span>Карты <span className="tb-chip ms-1" title="Игроки не видят этот список — только текущую карту в комнате, под туманом">только ГМ</span></span>
        <span className="d-flex gap-3">
          <Link href={`/campaigns/${campaignId}/maps/library`} className="small">Из библиотеки</Link>
          <Link href={`/campaigns/${campaignId}/maps/new`} className="small">Новая карта</Link>
        </span>
      </div>
      <div className="card-body">
        <div className="row g-3">
          {maps.map((map) => {
            const isCurrent = String(map._id) === currentMap
            return (
              <div key={String(map._id)} className="col-sm-6 col-lg-4">
                <div className={`card h-100 bg-dark ${isCurrent ? 'border-success' : ''}`}>
                  <img src={map.thumbnailPath ?? map.backgroundImagePath} alt="" className="card-img-top object-fit-cover" style={{height: 140}}/>
                  <div className="card-body py-2">
                    <div className="d-flex align-items-center gap-2">
                      <Link href={`/campaigns/${campaignId}/maps/${map._id}`} className="fw-bold">{map.name}</Link>
                      {isCurrent && <span className="tb-chip tb-chip--success">в игре</span>}
                    </div>
                    {map.description && <div className="small text-muted">{map.description}</div>}
                    <div className="mt-2"><MapButtons campaignId={campaignId} mapId={String(map._id)} isCurrent={isCurrent}/></div>
                  </div>
                </div>
              </div>
            )
          })}
          {maps.length === 0 && <div className="tb-empty">Карт пока нет. «Новая карта» — загрузить картинку и выровнять сетку, «Из библиотеки» — взять готовую; первая сразу станет текущей.</div>}
        </div>
      </div>
    </div>
  )
}
