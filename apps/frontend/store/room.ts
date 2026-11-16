'use client'
//Campaign room state (zustand): one socket per page, shared by the request dock and the game room canvas.
//Server events update characters, map, tokens, fog, chat, requests; canvas-local state (tool, selection, ruler, ghosts) lives here too.
import {create} from "zustand"
import {io, Socket} from "socket.io-client"
import type {ActionRequest, RequestSubject, Verdict} from "@frontend/deps/interfaces/shared/ActionRequest"
import type {FChatMessage} from "@frontend/deps/interfaces/DB/Chat"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import type {IMap} from "@frontend/deps/interfaces/DB/Map"
import type {IToken} from "@frontend/deps/interfaces/DB/Token"
import type {JoinData, OnlineUser, ServerEmitsMap, ServerProcedureName, ServerProcedures} from "@frontend/deps/registry/socketEvents"
import type {TurnOrder} from "@frontend/deps/interfaces/shared/TurnOrder"
import type {ShopState} from "@frontend/deps/interfaces/shared/Shop"
import {updateTile} from "@frontend/deps/_util/FoWUtils"
import {roomAccess} from "@frontend/actions/room"

export interface RoomUser {
  id: string
  username: string
  role: 'ГМ' | 'Игрок'
}

export type CanvasTool = 'pointer' | 'ruler' | 'vision'
type Point = { x: number; y: number }
export interface VisionRect { startX: number; startY: number; currentX: number; currentY: number; show: boolean }
interface PeerMark { user: { _id: unknown; username: string; role: 'ГМ' | 'Игрок' } }
export interface MapPing { id: number; position: Point; user: OnlineUser }

interface RoomState {
  campaignId: string | null
  user: RoomUser | null
  connected: boolean
  characters: Record<string, EvaluatedCharacter>
  map: IMap | null
  tokens: Record<string, IToken>
  messages: FChatMessage[]
  requests: ActionRequest[]
  notices: string[]
  turnOrder: TurnOrder                                                                                                  //initiative list (DM-kept); players hide lines they may not see
  shop: ShopState                                                                                                       //the campaign shop: open or not, its rolled shelf
  online: OnlineUser[]                                                                                                  //who holds a socket in the room
  pings: MapPing[]                                                                                                      //"look here" pulses, gone after a moment

  lines: Record<string, { from: Point; to: Point | null } & PeerMark>                                                   //rulers by user id
  ghosts: Record<string, { position: Point } & PeerMark>                                                                //drag previews by character id
  tool: CanvasTool
  selected: string[]                                                                                                    //character ids of selected tokens
  placing: string | null                                                                                                //DM: character waiting for a click on the map
  visionRect: VisionRect | null

  connect: (campaignId: string, user: RoomUser) => void
  disconnect: () => void
  emit: <K extends ServerProcedureName>(event: K, data: ServerProcedures[K]) => void
  request: (characterId: string, subject: RequestSubject) => void
  cancel: (requestId: string) => void
  verdict: (requestId: string, verdict: Verdict) => void
  notify: (text: string) => void
  dismissNotice: (index: number) => void
  setTool: (tool: CanvasTool) => void
  setSelected: (ids: string[]) => void
  setPlacing: (id: string | null) => void
  setVisionRect: (rect: VisionRect | null) => void
}

const logLength = 200
const pingLifetime = 2600
const noTurns: TurnOrder = {round: 1, current: null, entries: []}
const closedShop: ShopState = {open: false, magicLimit: 3, maxRarity: 'uncommon', entries: []}
let pingCount = 0
let socket: Socket | null = null
let users = 0                                                                                                           //components holding the connection
let attempt = 0                                                                                                         //bumped per connect / disconnect: a stale ticket fetch drops its socket
const characterListeners = new Set<(id: string) => void>()

//sheet pages refresh their server render when a character changes; returns the unsubscribe
export function onCharacterUpdate(listener: (id: string) => void): () => void {
  characterListeners.add(listener)
  return () => { characterListeners.delete(listener) }
}

//fog string with a rectangle shown or hidden
function fogRect(map: IMap, rect: { minX: number; minY: number; maxX: number; maxY: number }, show: boolean): IMap {
  if (!map.fogOfWar) return map
  let fog = map.fogOfWar.exploredAreas
  for (let x = rect.minX; x <= rect.maxX; x++) for (let y = rect.minY; y <= rect.maxY; y++) fog = updateTile(fog, map.gridConfig.size.x, x, y, show)
  return {...map, fogOfWar: {...map.fogOfWar, exploredAreas: fog}}
}

const tokensOf = (map: IMap | null) => Object.fromEntries((map?.tokens ?? []).map((token) => [String(token.character), token]))

export const useRoomStore = create<RoomState>()((set, get) => {
  //server -> client handlers; each updates one slice
  const handlers: { [K in keyof ServerEmitsMap]?: (data: ServerEmitsMap[K]) => void } = {
    'requests': ({requests}) => set({requests}),
    'turn-order': ({turnOrder}) => set({turnOrder}),
    'shop': ({shop}) => set({shop}),
    'presence': ({users}) => set({online: users}),
    'ping': ({position, user}) => {
      const id = ++pingCount
      set((state) => ({pings: [...state.pings.slice(-11), {id, position, user}]}))
      setTimeout(() => set((state) => ({pings: state.pings.filter((ping) => ping.id !== id)})), pingLifetime)
    },
    'chat-message': ({message}) => set((state) => ({messages: [...state.messages, message].slice(-logLength)})),
    'system-message': ({message}) => get().notify(message.content),
    'update-character': ({character}) => {
      const id = String(character._id)
      set((state) => ({characters: {...state.characters, [id]: {...state.characters[id], ...character} as EvaluatedCharacter}}))
      characterListeners.forEach((listener) => listener(id))
    },
    'set-characters': ({characters}) => set({characters: Object.fromEntries(characters.map((character) => [String(character._id), character]))}),
    'current-map': ({map}) => set({map, tokens: tokensOf(map), selected: [], ghosts: {}, lines: {}, pings: [], placing: null}),
    'create-token': ({token}) => set((state) => ({tokens: {...state.tokens, [String(token.character)]: token}})),
    'remove-token': ({characterIds}) => set((state) => {
      const gone = characterIds.map(String)
      const keep = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([id]) => !gone.includes(id)))
      return {tokens: keep(state.tokens), ghosts: keep(state.ghosts), selected: state.selected.filter((id) => !gone.includes(id))}
    }),
    'remove-characters': ({characterIds}) => set((state) => {
      const gone = characterIds.map(String)
      return {characters: Object.fromEntries(Object.entries(state.characters).filter(([id]) => !gone.includes(id))), placing: state.placing && gone.includes(state.placing) ? null : state.placing}
    }),
    'token-moved': ({characterId, to}) => set((state) => {
      const id = String(characterId)
      const {[id]: _dropped, ...ghosts} = state.ghosts
      const token = state.tokens[id]
      return {ghosts, tokens: token ? {...state.tokens, [id]: {...token, position: to}} : state.tokens}
    }),
    'token-drag-preview': ({characterId, to, user}) => set((state) => ({ghosts: {...state.ghosts, [String(characterId)]: {position: to, user}}})),
    'toggle-tokens-visibility': ({tokenIds, visible}) => set((state) => {
      const tokens = {...state.tokens}
      for (const id of tokenIds.map(String)) if (tokens[id]) tokens[id] = {...tokens[id], visible}
      return {tokens}
    }),
    'draw-line': ({from, to, user}) => set((state) => ({lines: {...state.lines, [String(user._id)]: {from, to, user}}})),
    'clear-line': ({user}) => set((state) => {
      const {[String(user._id)]: _dropped, ...lines} = state.lines
      return {lines}
    }),
    'reveal-tile': ({position}) => set((state) => ({map: state.map && fogRect(state.map, {minX: position.x, minY: position.y, maxX: position.x, maxY: position.y}, true)})),
    'hide-tile': ({position}) => set((state) => ({map: state.map && fogRect(state.map, {minX: position.x, minY: position.y, maxX: position.x, maxY: position.y}, false)})),
    'reveal-rect': (rect) => set((state) => ({map: state.map && fogRect(state.map, rect, true)})),
    'hide-rect': (rect) => set((state) => ({map: state.map && fogRect(state.map, rect, false)}))
  }

  return {
    campaignId: null, user: null, connected: false,
    characters: {}, map: null, tokens: {}, messages: [], requests: [], notices: [],
    turnOrder: noTurns, shop: closedShop, online: [], pings: [],
    lines: {}, ghosts: {}, tool: 'pointer', selected: [], placing: null, visionRect: null,

    connect: (campaignId, user) => {
      users++
      if (socket && get().campaignId === campaignId) return
      socket?.disconnect()
      socket = null
      const mine = ++attempt
      set({campaignId, user, connected: false, requests: [], messages: [], notices: [], turnOrder: noTurns, shop: closedShop, online: [], pings: []})

      void (async () => {
        const first = await roomAccess(campaignId)
        if (mine !== attempt) return
        if (!first.data) return get().notify(`Комната недоступна: ${first.message}`)
        const {url, port} = first.data
        let pendingTicket: string | null = first.data.ticket                                                            //one-time: later reconnects fetch a new one

        const direct = `${window.location.protocol}//${window.location.hostname}:${port}`
        const created = io(url ?? (window.location.port ? direct : window.location.origin), {                           //no port in the page URL = behind a proxy that routes /socket.io/
          path: '/socket.io',
          transports: ['websocket'],
          auth: (callback) => {
            if (pendingTicket) { callback({ticket: pendingTicket}); pendingTicket = null; return }
            void roomAccess(campaignId).then((access) => callback({ticket: access.data?.ticket}))
          }
        })
        socket = created
        created.on('connect', () => set({connected: true}))
        created.on('disconnect', () => set({connected: false}))
        created.on('error', (payload: { message?: string }) => get().notify(payload?.message ?? 'Ошибка соединения'))
        created.on('connected', (payload: JoinData) => set({
          messages: payload.messages.slice(-logLength),
          characters: Object.fromEntries(payload.characters.map((character) => [String(character._id), character])),
          map: payload.currentMap, tokens: tokensOf(payload.currentMap),
          turnOrder: payload.turnOrder ?? noTurns,
          shop: payload.shop ?? closedShop
        }))
        for (const [event, handler] of Object.entries(handlers)) created.on(event, handler as (data: unknown) => void)
      })()
    },

    disconnect: () => {
      users = Math.max(0, users - 1)
      if (users > 0) return
      attempt++
      socket?.disconnect()
      socket = null
      set({campaignId: null, connected: false, map: null, tokens: {}, characters: {}, requests: [], selected: [], placing: null, turnOrder: noTurns, shop: closedShop, online: [], pings: []})
    },

    emit: (event, data) => {
      if (!socket?.connected) return get().notify('Нет соединения с комнатой')
      socket.emit(event, data, (answer?: { ok: boolean; error?: string }) => {
        if (answer && !answer.ok) get().notify(answer.error ?? 'Ошибка сервера')
      })
    },
    request: (characterId, subject) => get().emit('request', {characterId, subject}),
    cancel: (requestId) => get().emit('cancel-request', {requestId}),
    verdict: (requestId, verdict) => get().emit('verdict', {requestId, verdict}),
    notify: (text) => set((state) => ({notices: [...state.notices.slice(-4), text]})),
    dismissNotice: (index) => set((state) => ({notices: state.notices.filter((_, position) => position !== index)})),
    setTool: (tool) => set({tool, placing: null}),
    setSelected: (selected) => set({selected}),
    setPlacing: (placing) => set({placing}),
    setVisionRect: (visionRect) => set({visionRect})
  }
})
