'use client'
//Pointer gestures on the map, first match wins: DM placing a token; DM fog (tool or Shift); ruler (tool or right button); token select / drag.
//A press none of them takes falls through to PanZoom (pan; a tap there clears the selection). Positions are only drawn — no game logic.
//A second press on the same spot (or Alt+click) pings it for everyone — unless it lands on a token whose sheet this user may open.
//The double press is timed here: PanZoom captures the pointer on empty map, so the browser's dblclick never reaches this layer.
//DM drops (party panel / bestiary picker): a character lands on the cell; a monster reuses its template in the campaign or makes one first.
import {DragEvent, PointerEvent, useRef} from "react"
import type {IMap} from "@frontend/deps/interfaces/DB/Map"
import {useRoomStore} from "@frontend/store/room"
import {Cell, cellAt, isRevealed, mayControl, pixelToCell, tokenAt, topLeftFor} from "@frontend/components/Game/Canvas/geometry"
import {DragPayload, dragType, useGameUI} from "@frontend/components/Game/GameUI"
import {createFromMonster} from "@frontend/actions/characters"

type Gesture =
  | { kind: 'ruler'; start: Cell; last: Cell }
  | { kind: 'vision'; start: Cell; moved: boolean }
  | { kind: 'token'; start: Cell; clientX: number; clientY: number; id: string; dragging: Map<string, Cell> | null; last: Cell }

const dragDistance = 6
const doublePress = {ms: 350, distance: 12}
const sameCell = (left: Cell, right: Cell) => left.x === right.x && left.y === right.y

export default function GestureLayer({map, width, height}: { map: IMap; width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastPress = useRef<{ time: number; clientX: number; clientY: number } | null>(null)
  const placing = useRoomStore((state) => state.placing)
  const {campaignId, open} = useGameUI()

  //map pixel and cell under the pointer
  const locate = (event: { clientX: number; clientY: number }) => {
    const rect = ref.current!.getBoundingClientRect()
    const pixelX = (event.clientX - rect.left) * (width / rect.width)
    const pixelY = (event.clientY - rect.top) * (height / rect.height)
    return {pixelX, pixelY, cell: cellAt(map, pixelX, pixelY)}
  }

  const take = (event: PointerEvent, next: Gesture) => {
    event.stopPropagation()
    event.preventDefault()
    ref.current?.setPointerCapture(event.pointerId)
    gesture.current = next
  }

  const onPointerDown = (event: PointerEvent) => {
    const state = useRoomStore.getState()
    const user = state.user
    if (!user) return
    const isDM = user.role === 'ГМ'
    const {pixelX, pixelY, cell} = locate(event)
    const primary = event.button === 0

    if (primary && event.altKey) {
      event.stopPropagation()
      return state.emit('ping', {position: pixelToCell(map, pixelX, pixelY)})
    }
    if (isDM && state.placing && primary) {
      event.stopPropagation()
      state.emit('create-token', {characterId: state.placing, position: topLeftFor(state.characters[state.placing], cell)})
      if (!state.characters[state.placing]?.isTemplate) state.setPlacing(null)                                          //a template keeps dropping copies until done
      return
    }
    if (isDM && map.fogOfWar?.enabled && primary && (state.tool === 'vision' || event.shiftKey)) {
      take(event, {kind: 'vision', start: cell, moved: false})
      state.setVisionRect({startX: cell.x, startY: cell.y, currentX: cell.x, currentY: cell.y, show: !isRevealed(map, cell)})
      return
    }
    if ((state.tool === 'ruler' && primary) || event.button === 2) {
      take(event, {kind: 'ruler', start: cell, last: cell})
      state.emit('draw-line', {from: {x: cell.x + 0.5, y: cell.y + 0.5}, to: {x: cell.x + 0.5, y: cell.y + 0.5}})
      return
    }
    const hit = state.tool === 'pointer' && primary ? tokenAt(map, pixelX, pixelY, state.tokens, state.characters, user) : undefined
    if (state.tool === 'pointer' && primary) {
      const previous = lastPress.current
      const repeated = !!previous && event.timeStamp - previous.time < doublePress.ms && Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY) < doublePress.distance
      lastPress.current = repeated ? null : {time: event.timeStamp, clientX: event.clientX, clientY: event.clientY}
      if (repeated && !(hit && mayControl(user, state.characters[String(hit.character)]))) {
        event.stopPropagation()
        return state.emit('ping', {position: pixelToCell(map, pixelX, pixelY)})
      }
    }
    if (state.tool === 'pointer' && primary && (isDM || isRevealed(map, cell))) {
      if (hit) take(event, {kind: 'token', start: cell, clientX: event.clientX, clientY: event.clientY, id: String(hit.character), dragging: null, last: cell})
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const active = gesture.current
    if (!active) return
    const state = useRoomStore.getState()
    const {cell} = locate(event)

    if (active.kind === 'ruler') {
      if (sameCell(cell, active.last)) return
      active.last = cell
      state.emit('draw-line', {from: {x: active.start.x + 0.5, y: active.start.y + 0.5}, to: {x: cell.x + 0.5, y: cell.y + 0.5}})
      return
    }
    if (active.kind === 'vision') {
      active.moved = active.moved || !sameCell(cell, active.start)
      if (state.visionRect) state.setVisionRect({...state.visionRect, currentX: cell.x, currentY: cell.y})
      return
    }

    //token: start dragging past a few pixels — the clicked token, or the whole selection when it is part of it (only those this user may move)
    if (!active.dragging) {
      if (Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) <= dragDistance) return
      const group = state.selected.includes(active.id) ? state.selected : [active.id]
      const movable = group.filter((id) => state.tokens[id] && state.user && mayControl(state.user, state.characters[id]))
      if (!movable.length) return
      active.dragging = new Map(movable.map((id) => [id, {x: state.tokens[id].position.x - active.start.x, y: state.tokens[id].position.y - active.start.y}]))
    }
    if (sameCell(cell, active.last)) return
    active.last = cell
    for (const [id, offset] of active.dragging) state.emit('token-drag-preview', {characterId: id, to: {x: cell.x + offset.x, y: cell.y + offset.y}})
  }

  const onPointerUp = (event: PointerEvent) => {
    const active = gesture.current
    gesture.current = null
    if (!active) return
    const state = useRoomStore.getState()
    const {cell} = locate(event)

    if (active.kind === 'ruler') return state.emit('clear-line', undefined)
    if (active.kind === 'vision') {
      const startShown = isRevealed(map, active.start)
      if (active.moved) {
        const rect = {minX: Math.min(active.start.x, cell.x), minY: Math.min(active.start.y, cell.y), maxX: Math.max(active.start.x, cell.x), maxY: Math.max(active.start.y, cell.y)}
        state.emit(startShown ? 'hide-rect' : 'reveal-rect', rect)
      } else state.emit(startShown ? 'hide-tile' : 'reveal-tile', {position: active.start})
      return state.setVisionRect(null)
    }

    if (!active.dragging) {
      //click: toggle in the selection (Ctrl / Shift adds), plain click selects only this one
      const additive = event.ctrlKey || event.metaKey || event.shiftKey
      const selected = state.selected.includes(active.id)
        ? state.selected.filter((id) => id !== active.id)
        : additive ? [...state.selected, active.id] : [active.id]
      return state.setSelected(selected)
    }
    const allowed = state.user?.role === 'ГМ' || isRevealed(map, cell)
    for (const [id, offset] of active.dragging) {
      const to = allowed ? {x: cell.x + offset.x, y: cell.y + offset.y} : state.tokens[id].position                     //into the fog: back where it was
      state.emit('move-token-end', {characterId: id, to})
    }
  }

  //double-click a token: its sheet in the drawer (a template copy opens its own sheet), for those who may open it
  const onDoubleClick = (event: { clientX: number; clientY: number }) => {
    const state = useRoomStore.getState()
    if (!state.user) return
    const {pixelX, pixelY} = locate(event)
    const token = tokenAt(map, pixelX, pixelY, state.tokens, state.characters, state.user)
    const character = token && state.characters[String(token.character)]
    if (character && mayControl(state.user, character)) open(`/characters/${character._id}`, character.name)
  }

  const accepts = (event: DragEvent) => useRoomStore.getState().user?.role === 'ГМ' && event.dataTransfer.types.includes(dragType)
  const onDragOver = (event: DragEvent) => {
    if (!accepts(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  //drop = the same create-token the click placement sends; templates spawn a numbered copy server-side
  const onDrop = async (event: DragEvent) => {
    if (!accepts(event)) return
    event.preventDefault()
    const {cell} = locate(event)
    let payload: DragPayload
    try { payload = JSON.parse(event.dataTransfer.getData(dragType)) } catch { return }
    const state = useRoomStore.getState()
    let characterId = payload.id
    if (payload.kind === 'monster') {
      const template = Object.values(state.characters).find((character) => character.monster === payload.id && character.isTemplate)
      if (template) characterId = String(template._id)
      else {
        const {data, message} = await createFromMonster(campaignId, payload.id)
        if (!data) return state.notify(message)
        characterId = String(data._id)
      }
    }
    state.emit('create-token', {characterId, position: topLeftFor(useRoomStore.getState().characters[characterId], cell)})
  }

  return (
    <div ref={ref} className="position-absolute top-0 start-0" style={{width, height, zIndex: 10, cursor: placing ? 'crosshair' : undefined}}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick}
         onDragOver={onDragOver} onDrop={(event) => void onDrop(event)}/>
  )
}
