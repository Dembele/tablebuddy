'use client'
//Map layers in map pixels: background + grid, tokens (HP tint for all who see them — exact for those who play them, in quarters for the rest — condition badges, a cross over the dead),
//fog of war, temporary marks (rulers, drag ghosts, DM fog box), pings, the ring on whoever's turn it is.
import {CSSProperties, Fragment, useEffect, useRef} from "react"
import type {IMap} from "@frontend/deps/interfaces/DB/Map"
import {useRoomStore} from "@frontend/store/room"
import {cellsOf, cellToPixel, mayControl, maySee, tokenBox} from "@frontend/components/Game/Canvas/geometry"
import {ConditionBadges, DeathSaves} from "@frontend/components/Game/ConditionIcons"
import {initialsOf} from "@frontend/components/UI/Avatar"

const layer = {background: 0, tokens: 1, fog: 2, marks: 3, pings: 4} as const
const peerColor = (role: string) => role === 'ГМ' ? '#e0564c' : '#5b9bd5'                                               //canvas ink: same as --tb-role-dm / --tb-role-player

//a canvas redrawn when its size or one of `inputs` changes
function useCanvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void, inputs: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    draw(context)
  }, [width, height, ...inputs]) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

export function BackgroundLayer({map, image}: { map: IMap; image: HTMLImageElement }) {
  const {width, height} = image
  const ref = useCanvas(width, height, (context) => {
    context.drawImage(image, 0, 0, width, height)
    if (map.gridType === 'none') return
    const {cellSize, offset, size, color, opacity} = map.gridConfig
    context.strokeStyle = color
    context.globalAlpha = opacity ?? 0.8
    context.lineWidth = 1
    context.beginPath()
    for (let column = 0; column <= size.x; column++) {
      const x = offset.left + column * cellSize.x + 0.5
      context.moveTo(x, offset.top); context.lineTo(x, offset.top + size.y * cellSize.y)
    }
    for (let row = 0; row <= size.y; row++) {
      const y = offset.top + row * cellSize.y + 0.5
      context.moveTo(offset.left, y); context.lineTo(offset.left + size.x * cellSize.x, y)
    }
    context.stroke()
    context.globalAlpha = 1
  }, [image, map.gridType, map.gridConfig])
  return <canvas ref={ref} width={width} height={height} className="position-absolute top-0 start-0" style={{zIndex: layer.background}}/>
}

export function FogLayer({map, width, height}: { map: IMap; width: number; height: number }) {
  const isDM = useRoomStore((state) => state.user?.role === 'ГМ')
  const ref = useCanvas(width, height, (context) => {
    if (!map.fogOfWar?.enabled) return
    const {cellSize, size} = map.gridConfig
    context.fillStyle = `rgba(18, 18, 18, ${isDM ? 0.6 : 1})`
    context.fillRect(0, 0, width, height)
    const explored = map.fogOfWar.exploredAreas
    for (let index = explored.indexOf('1'); index !== -1; index = explored.indexOf('1', index + 1)) {
      const origin = cellToPixel(map, index % size.x, Math.floor(index / size.x))
      context.clearRect(origin.x - 0.5, origin.y - 0.5, cellSize.x + 1, cellSize.y + 1)
    }
  }, [map.fogOfWar, map.gridConfig, isDM])
  if (!map.fogOfWar?.enabled) return null
  return <canvas ref={ref} width={width} height={height} className="position-absolute top-0 start-0 pe-none" style={{zIndex: layer.fog}}/>
}

export function TokensLayer({map}: { map: IMap }) {
  const tokens = useRoomStore((state) => state.tokens)
  const characters = useRoomStore((state) => state.characters)
  const selected = useRoomStore((state) => state.selected)
  const user = useRoomStore((state) => state.user)
  const turnOrder = useRoomStore((state) => state.turnOrder)
  if (!user) return null
  const onTurn = turnOrder.entries.find((entry) => entry.id === turnOrder.current)
  const turnOf = onTurn && !(onTurn.hidden && user.role !== 'ГМ') ? onTurn.characterId : undefined                      //a hidden line stays hidden on the map too

  return (
    <div className="position-absolute top-0 start-0 pe-none" style={{zIndex: layer.tokens}}>
      {Object.values(tokens).map((token) => {
        const id = String(token.character)
        const character = characters[id]
        if (!character || !maySee(user, token, character)) return null
        const box = tokenBox(map, token, characters, tokens)
        const {current, max, temp} = character.hitPoints
        const showHealth = mayControl(user, character) && max > 0                                                         //exact tint, temp HP, death saves
        const wound = max > 0 ? Math.min(1, Math.max(0, 1 - current / max)) : 0
        const damage = showHealth ? wound : Math.ceil(wound * 4) / 4                                                     //others see how hurt it looks, not the numbers
        const down = max > 0 && current <= 0
        const dead = down && (character.deathSavingThrows.failure >= 3 || character.isNPC || !!character.monster)          //PCs after three failed saves; NPCs and monsters at 0
        const badge = Math.max(10, Math.min(28, box.width * 0.3))
        return (
          <Fragment key={id}>
          {turnOf === id && <div className="map-turn" style={{left: box.left, top: box.top, width: box.width, height: box.height, '--ring': `${Math.max(4, box.width * 0.1)}px`} as CSSProperties}/>}
          <div className={`map-token ${token.visible ? '' : 'is-concealed'} ${selected.includes(id) ? 'is-selected' : ''}`} title={character.name}
               style={{left: box.left, top: box.top, width: box.width, height: box.height}}>
            {character.avatar
              ? <img src={character.avatar} alt="" className="w-100 h-100 object-fit-cover" draggable={false}/>
              : <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-secondary text-white fw-bold" style={{fontSize: box.height * 0.36}}>{initialsOf(character.name)}</div>}
            {damage > 0 && !down && (
              <div className="position-absolute top-0 start-0 w-100 h-100" style={{background: `linear-gradient(to bottom, rgba(220,38,38,${damage * 0.7}) ${damage * 100}%, transparent ${damage * 100}%)`}}/>
            )}
            {down && <div className="position-absolute top-0 start-0 w-100 h-100" style={{background: 'rgba(40,40,40,.75)'}}/>}
            {dead && (
              <svg className="position-absolute top-0 start-0 w-100 h-100" viewBox="0 0 100 100" aria-label="Мёртв">
                <path d="M18 18 L82 82 M82 18 L18 82" stroke="rgba(220,38,38,.95)" strokeWidth="12" strokeLinecap="round"/>
              </svg>
            )}
            {showHealth && (temp ?? 0) > 0 && <div className="position-absolute top-0 start-0 w-100 h-100 rounded-circle" style={{border: `${Math.max(2, box.width * 0.05)}px solid rgba(34,211,238,.9)`}}/>}
          </div>
          {showHealth && down && !dead && (
            <div className="position-absolute d-flex justify-content-center" style={{left: box.left, top: box.top - badge * 0.45, width: box.width}}>
              <DeathSaves saves={character.deathSavingThrows} size={badge * 0.7}/>
            </div>
          )}
          {character.conditions.length > 0 && (
            <div className="position-absolute d-flex justify-content-center" style={{left: box.left, top: box.top + box.height - badge * 0.6, width: box.width, gap: 1}}>
              <ConditionBadges conditions={character.conditions} size={badge} limit={Math.max(1, Math.floor(box.width / (badge + 1)) - 1)}/>
            </div>
          )}
          </Fragment>
        )
      })}
    </div>
  )
}

//rulers (with feet), drag ghosts (line + distance), the DM's fog box preview
export function MarksLayer({map, width, height}: { map: IMap; width: number; height: number }) {
  const lines = useRoomStore((state) => state.lines)
  const ghosts = useRoomStore((state) => state.ghosts)
  const tokens = useRoomStore((state) => state.tokens)
  const characters = useRoomStore((state) => state.characters)
  const visionRect = useRoomStore((state) => state.visionRect)
  const user = useRoomStore((state) => state.user)
  const feet = map.gridConfig.feats || 5

  const ref = useCanvas(width, height, (context) => {
    const label = (text: string, x: number, y: number, color: string) => {
      context.font = 'bold 15px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const textWidth = context.measureText(text).width
      context.fillStyle = 'rgba(255,255,255,.92)'
      context.fillRect(x - textWidth / 2 - 6, y - 11, textWidth + 12, 22)
      context.strokeStyle = color
      context.lineWidth = 2
      context.strokeRect(x - textWidth / 2 - 6, y - 11, textWidth + 12, 22)
      context.fillStyle = color
      context.fillText(text, x, y)
    }
    const segment = (from: { x: number; y: number }, to: { x: number; y: number }, color: string, cells: number) => {
      const start = cellToPixel(map, from.x, from.y)
      const end = cellToPixel(map, to.x, to.y)
      context.strokeStyle = color
      context.lineWidth = 4
      context.setLineDash([10, 6])
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
      context.setLineDash([])
      if (cells > 0) label(`${cells * feet} фт.`, (start.x + end.x) / 2, (start.y + end.y) / 2, color)
    }

    for (const {from, to, user: owner} of Object.values(lines)) {
      if (!to) continue
      const color = peerColor(owner.role)
      if (from.x === to.x && from.y === to.y) {
        const cell = cellToPixel(map, from.x - 0.5, from.y - 0.5)
        context.fillStyle = color
        context.globalAlpha = 0.5
        context.fillRect(cell.x, cell.y, map.gridConfig.cellSize.x, map.gridConfig.cellSize.y)
        context.globalAlpha = 1
      } else segment(from, to, color, Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)))
    }

    for (const [id, {position, user: mover}] of Object.entries(ghosts)) {
      const token = tokens[id]
      const character = characters[id]
      if (!token || !character || !user || !maySee(user, token, character)) continue
      const half = cellsOf(character) / 2
      const color = peerColor(mover.role)
      segment({x: token.position.x + half, y: token.position.y + half}, {x: position.x + half, y: position.y + half}, color,
        Math.max(Math.abs(position.x - token.position.x), Math.abs(position.y - token.position.y)))
      const center = cellToPixel(map, position.x + half, position.y + half)
      context.globalAlpha = 0.55
      context.fillStyle = 'white'
      context.beginPath(); context.arc(center.x, center.y, half * map.gridConfig.cellSize.x - 3, 0, Math.PI * 2); context.fill()
      context.globalAlpha = 1
    }

    if (visionRect) {
      const left = Math.min(visionRect.startX, visionRect.currentX)
      const top = Math.min(visionRect.startY, visionRect.currentY)
      const origin = cellToPixel(map, left, top)
      const boxWidth = (Math.abs(visionRect.currentX - visionRect.startX) + 1) * map.gridConfig.cellSize.x
      const boxHeight = (Math.abs(visionRect.currentY - visionRect.startY) + 1) * map.gridConfig.cellSize.y
      const color = visionRect.show ? '#22c55e' : '#ef4444'
      context.fillStyle = color
      context.globalAlpha = 0.3
      context.fillRect(origin.x, origin.y, boxWidth, boxHeight)
      context.globalAlpha = 1
      context.strokeStyle = color
      context.lineWidth = 3
      context.setLineDash([8, 4])
      context.strokeRect(origin.x, origin.y, boxWidth, boxHeight)
      context.setLineDash([])
    }
  }, [lines, ghosts, tokens, characters, visionRect, user, map.gridConfig])

  return <canvas ref={ref} width={width} height={height} className="position-absolute top-0 start-0 pe-none" style={{zIndex: layer.marks}}/>
}

//"look here" pulses (double-click or Alt+click on the map): drawn for a moment for everyone, in the pinger's role colour
export function PingLayer({map}: { map: IMap }) {
  const pings = useRoomStore((state) => state.pings)
  const size = Math.max(map.gridConfig.cellSize.x, map.gridConfig.cellSize.y) * 3
  return (
    <div className="position-absolute top-0 start-0 pe-none" style={{zIndex: layer.pings}}>
      {pings.map((ping) => {
        const point = cellToPixel(map, ping.position.x, ping.position.y)
        return (
          <div key={ping.id} className={`map-ping ${ping.user.role === 'ГМ' ? 'is-dm' : ''}`} style={{left: point.x, top: point.y, '--ping-size': `${size}px`} as CSSProperties}>
            <span className="map-ping__name">{ping.user.username}</span>
          </div>
        )
      })}
    </div>
  )
}
