//One library map as a card (server): thumbnail, name, description, the monsters it places («Гоблин ×4, Волк ×2»); actions come as children.
import {ReactNode} from "react"
import Link from "next/link"
import type {LibraryMapSummary} from "@frontend/actions/maps"
import {getMonster, MonsterId, monsters} from "@frontend/deps/data/loader"

//placements counted per monster, by bestiary name
export function placementDigest(placements: LibraryMapSummary['placements']): string {
  const counts: Record<string, number> = {}
  for (const placement of placements ?? []) {
    if (!(placement.monster in monsters)) continue
    const name = getMonster(placement.monster as MonsterId).name
    counts[name] = (counts[name] ?? 0) + 1
  }
  return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} ×${count}` : name).join(', ')
}

export default function LibraryCard({map, href, children}: { map: LibraryMapSummary; href?: string; children?: ReactNode }) {
  const monstersPlaced = placementDigest(map.placements)
  return (
    <div className="col-sm-6 col-lg-4">
      <div className="card h-100 bg-dark">
        <img src={map.thumbnailPath ?? map.backgroundImagePath} alt="" className="card-img-top object-fit-cover" style={{height: 140}}/>
        <div className="card-body py-2">
          {href ? <Link href={href} className="fw-bold">{map.name}</Link> : <b>{map.name}</b>}
          {map.description && <div className="small text-muted">{map.description}</div>}
          <div className="small mt-1">{monstersPlaced ? <>Монстры: {monstersPlaced}</> : <span className="text-muted">Без монстров</span>}</div>
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  )
}
