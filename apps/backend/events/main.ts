//Game hub: one CampaignRoom per campaign (clients, map, chat tail, request queue), typed procedures bound per socket.
//Sockets authenticate by a one-time ticket (services/SocketTickets) issued over session-checked REST.
import {Server, Socket} from "socket.io"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {ObjectId} from "@backend/deps/types/internal/ObjectId"
import {
  JoinData,
  OnlineUser,
  ServerEmitsMap,
  ServerEventName,
  ServerProcedureName,
  ServerProcedures
} from "@backend/deps/registry/socketEvents"
import {Campaign} from "@backend/models/Campaign"
import {Map as MapDoc} from "@backend/models/Map"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {Character} from "@backend/models/Character"
import {Chat} from "@backend/models/ChatMessage"
import {characterManager} from "@backend/services/CharacterManager"
import {typedEntries, typedKeys} from "@backend/deps/_util/translationMap"
import {FChatMessage} from "@backend/deps/interfaces/DB/Chat"
import {ActionRequest} from "@backend/deps/interfaces/shared/ActionRequest"
import {redeemTicket} from "@backend/services/SocketTickets"
import {TurnOrder} from "@backend/deps/interfaces/shared/TurnOrder"
import {emptyTurnOrder, readTurnOrder, removeEntries} from "@backend/deps/rules/turns"
import {ShopState} from "@backend/deps/interfaces/shared/Shop"
import {emptyShop} from "@backend/deps/rules/shop"

const historyLength = 100                                                                                               //chat messages a room keeps and sends on join

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
export type BroadcastUtils = {
  $all: <K extends ServerEventName>(event: K, data?: ServerEmitsMap[K]) => void
  $dm: <K extends ServerEventName>(event: K, data?: ServerEmitsMap[K]) => void
  $players: <K extends ServerEventName>(event: K, data?: ServerEmitsMap[K]) => void
  $player: (userId: ObjectId, event: ServerEventName, data?: any) => void
  $self: <K extends ServerEventName>(event: K, data?: ServerEmitsMap[K]) => void
  $requests: () => void                                                                                                 //queue to everyone: DM in full, players their own without dice
}

type Handler<Event extends ServerProcedureName> = (
  ctx: {
    data: ServerProcedures[Event]
    user: UserSafe
    campaign: InstanceType<typeof Campaign>
    room: CampaignRoom
    map: InstanceType<typeof MapDoc>
  } & BroadcastUtils
) => Promise<any> | any

// ─────────────────────────────────────────────────────────────────────
// CampaignRoom — The Heart
// ─────────────────────────────────────────────────────────────────────
export class CampaignRoom {
  public readonly campaignId: ObjectId
  public clients = new Map<string, UserSafe>() // socket.id → user
  private _currentMap?: InstanceType<typeof MapDoc>
  private charList: Array<ObjectId> = []
  private messageList: Array<FChatMessage> = []
  public requests = new Map<string, ActionRequest>()                                                                    //in memory: lost when the room unloads
  private _turnOrder: TurnOrder = emptyTurnOrder()                                                                       //initiative list; stored on the campaign
  private _shop: ShopState = emptyShop()                                                                                 //the shop the DM opens; stored on the campaign
  private dirtyDocs: Set<'campaign' | 'map'> = new Set()
  private unloading = false
  private saveTimeout?: NodeJS.Timeout

  constructor(campaignId: ObjectId) {
    this.campaignId = campaignId
  }

  private _campaign?: InstanceType<typeof Campaign>

  get campaign(): InstanceType<typeof Campaign> {
    if (!this._campaign) throw new Error("Campaign is undefined")
    return this._campaign
  }

  get map(): InstanceType<typeof MapDoc> {
    if (!this._currentMap) throw new Error("Map is undefined")
    return this._currentMap
  }

  addMessage(msg: FChatMessage) {
    this.messageList = [...this.messageList, msg].slice(-historyLength)
  }

  addClient(socketId: string, user: UserSafe) {
    this.clients.set(socketId, user)
  }

  removeClient(socketId: string) {
    this.clients.delete(socketId)
  }

  getClientCount() {
    return this.clients.size
  }

  getDM() {
    return [...this.clients.values()].find(u => u.role === "ГМ")
  }

  //a character joined the campaign while the room is loaded (template copy)
  addCharacter(characterId: ObjectId) {
    if (!this.charList.some(id => String(id) === String(characterId))) this.charList.push(characterId)
  }

  //characters gone: off the list, their queued requests dropped; true when their initiative lines went too
  removeCharacters(characterIds: string[]): boolean {
    this.charList = this.charList.filter(id => !characterIds.includes(String(id)))
    for (const [requestId, request] of this.requests) if (characterIds.includes(request.characterId)) this.requests.delete(requestId)
    const pruned = removeEntries(this._turnOrder, entry => !!entry.characterId && characterIds.includes(entry.characterId))
    if (pruned === this._turnOrder) return false
    this.turnOrder = pruned
    return true
  }

  hasCharacter(characterId: string) {
    return this.charList.some(id => String(id) === characterId)
  }

  get turnOrder(): TurnOrder {
    return this._turnOrder
  }

  //the DM changed the initiative list: kept here, saved with the campaign
  set turnOrder(order: TurnOrder) {
    this._turnOrder = order
    this.updateCampaign(campaign => { campaign.set('turnOrder', order) })
  }

  get shop(): ShopState {
    return this._shop
  }

  //opened, rolled, closed or sold from: kept here, saved with the campaign
  set shop(state: ShopState) {
    this._shop = state
    this.updateCampaign(campaign => { campaign.set('shop', state) })
  }

  //everyone holding a socket, once each
  online(): OnlineUser[] {
    const users = new Map<string, OnlineUser>()
    for (const user of this.clients.values()) users.set(String(user._id), {id: String(user._id), username: user.username, role: user.role})
    return [...users.values()]
  }

  getClientByUserId(userId: ObjectId) {
    return [...this.clients.entries()].find(([_, u]) => u._id.toString() === userId.toString())?.[0]
  }

  async load() {
    const campaign = await Campaign.findById(this.campaignId)
      .populate('currentMap')
      .lean(false)

    if (!campaign) throw new Error(`Campaign ${this.campaignId.toString()} not found`)

    const [rawCharacters, messages] = await Promise.all([
      Character.find({campaign: this.campaignId, name: {$ne: "not_init"}}).lean(),
      Chat.find({campaignId: this.campaignId})
        .sort({timestamp: -1, _id: -1})                                                                                  //newest first, so the limit keeps the latest
        .limit(historyLength)
        .populate<{ sender: Pick<UserSafe, '_id' | 'username' | 'role'> }>('sender', 'username role _id')
        .populate<{
          introduceAsCharacter: Pick<ICharacter, 'name' | 'avatar' | '_id'>
        }>('introduceAsCharacter', '_id name avatar')
        .lean()
    ])

    this.charList = rawCharacters.map(c => c._id)
    this.messageList = messages.reverse()                                                                               //back to oldest → newest for the log
    this._campaign = campaign
    this._turnOrder = readTurnOrder(campaign.toObject().turnOrder)
    this._shop = {...emptyShop(), ...(campaign.toObject().shop ?? {})}
    this._currentMap = (campaign.currentMap ?? undefined) as InstanceType<typeof MapDoc> | undefined

    console.log(`CampaignRoom loaded: ${this.campaignId.toString()} (${this.clients.size} online)`)
  }

  scheduleSave() {
    clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(async () => {
      try {
        const saves: Promise<any>[] = []
        if (this.dirtyDocs.has('campaign')) {
          saves.push(this.campaign.save())
        }
        if (this.dirtyDocs.has('map') && this._currentMap) {
          saves.push(this.map.save())
        }

        if (saves.length > 0) {
          const results = await Promise.allSettled(saves)
          results.forEach(result => {
            if (result.status === 'rejected') {
              console.error(`Save failed`, result.reason)
            }
          })
          this.dirtyDocs.clear()
        }
      } catch (err) {
        console.error(`Failed to persist campaign ${this.campaignId.toString()}`, err)
      }
    }, 500)
  }

  public async buildInitPayload(user: UserSafe): Promise<JoinData> {
    //the list is re-read on every join: characters built, created or moved here while the room stayed loaded must show up
    //(sheets themselves come from the manager's in-memory copies, never queried twice)
    const listed = await Character.find({campaign: this.campaignId, name: {$ne: "not_init"}}).select('_id').lean()
    this.charList = listed.map(entry => entry._id)

    const currentMap = this._currentMap?.toObject() ?? null
    const characters = await Promise.all(
      this.charList.map(c => characterManager.getOrCreateCharacter(c))
    )

    return {
      currentMap,
      characters: characters.map(char => char.evaluatedData),
      messages: this.messageList,
      turnOrder: this._turnOrder,
      shop: this._shop
    }
  }

  updateCampaign(updater: (campaign: InstanceType<typeof Campaign>) => void) {
    updater(this.campaign)
    this.dirtyDocs.add('campaign')
    this.scheduleSave()
  }

  updateMap(updater: (campaign: InstanceType<typeof MapDoc>) => void) {
    updater(this.map)
    this.dirtyDocs.add('map')
    this.scheduleSave()
  }

  //REST changed the campaign or its maps: flush pending room writes, then read everything again
  async reload() {
    await this.unload()
    await this.load()
  }

  get currentMap(): InstanceType<typeof MapDoc> | undefined {
    return this._currentMap
  }

  async unload() {
    if (this.unloading) return
    this.unloading = true
    clearTimeout(this.saveTimeout)
    try {
      await Promise.all([
        this._campaign?.save(),
        this._currentMap?.save()
      ])
    } catch (err) {
      console.error('Final save failed on unload', err)
    } finally {
      this.unloading = false
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// GameHub — The One Class to Rule Them All
// ─────────────────────────────────────────────────────────────────────
export class GameHub {
  private io: Server
  private rooms = new Map<string, CampaignRoom>() // campaignId string → room
  private procedures: { [K in ServerProcedureName]?: Handler<any> } = {}

  constructor(io: Server) {
    this.io = io
    io.on("connection", this.handleConnection.bind(this))
  }

  //a loaded room re-reads campaign + current map and tells its clients; unloaded rooms load fresh on the next join
  async reloadRoom(campaignId: ObjectId) {
    const room = this.rooms.get(campaignId.toString())
    if (!room) return
    await room.reload()
    this.io.to(campaignId.toString()).emit('current-map', {map: room.currentMap?.toObject() ?? null})
  }

  //a character created over REST joins a loaded room's list and every client's party panel at once
  async announceCharacter(campaignId: ObjectId, characterId: ObjectId) {
    const room = this.rooms.get(campaignId.toString())
    if (!room) return
    room.addCharacter(characterId)
    const live = await characterManager.getOrCreateCharacter(characterId)
    this.io.to(campaignId.toString()).emit('update-character', {character: live.evaluatedData})
  }

  //a deleted character leaves a loaded room's list and every client's panels
  forgetCharacter(campaignId: ObjectId, characterId: string) {
    const room = this.rooms.get(campaignId.toString())
    if (!room) return
    const pruned = room.removeCharacters([characterId])
    this.io.to(campaignId.toString()).emit('remove-characters', {characterIds: [characterId]})
    if (pruned) this.io.to(campaignId.toString()).emit('turn-order', {turnOrder: room.turnOrder})
  }

  procedure<Event extends ServerProcedureName>(name: Event, handler: Handler<Event>) {
    this.procedures[name] = handler
  }

  private async getRoom(campaignId: ObjectId): Promise<CampaignRoom> {
    const key = campaignId.toString()
    let room = this.rooms.get(key)
    if (!room) {
      room = new CampaignRoom(campaignId)
      await room.load()
      this.rooms.set(key, room)
    }
    return room
  }

  private handleConnection = async (socket: Socket) => {
    const redeemed = redeemTicket(socket.handshake.auth?.ticket)
    if (!redeemed) {
      socket.emit("error", {message: "Unauthorized"})
      socket.disconnect(true)
      return
    }
    const {user, campaignId: campaignIdStr} = redeemed

    let room: CampaignRoom
    try {
      room = await this.getRoom(campaignIdStr)
    } catch (error) {
      console.error(`Room ${campaignIdStr} failed to load`, error)
      socket.emit("error", {message: "Campaign not found"})
      socket.disconnect(true)
      return
    }
    const campaign = room.campaign

    // Join room + register client
    await socket.join(campaignIdStr)
    room.addClient(socket.id, user)

    console.log(`${user.username} (${user.role}) → campaign ${campaignIdStr}`)

    // === BROADCAST UTILS — now powered by room.clients ===
    const broadcaster = this.createBroadcaster(campaignIdStr, socket)


    // Initial state
    const initPayload = await room.buildInitPayload(user)
    socket.emit("connected", {
      ...initPayload,
      procedures: typedKeys(this.procedures)
    })
    broadcaster.$requests()
    this.io.to(campaignIdStr).emit('presence', {users: room.online()})

    // Bind all procedures
    typedEntries(this.procedures).forEach(([name, handler]) => {
      if (!handler) return // Narrowing for optional
      socket.on(name, async (data, ack: Function = () => {
      }) => {
        try {
          const result = await handler({data, user, campaign, room, get map() { return room.map }, ...broadcaster}) //map read per call: it may change or be absent
          ack({ok: true, data: result})
        } catch (err: any) {
          console.error(`[RPC:${name}]`, err)
          ack({ok: false, error: err.message || "Server error"})
        }
      })
    })

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      room.removeClient(socket.id)
      this.io.to(campaignIdStr).emit('presence', {users: room.online()})
      console.log(`${user.username} left campaign ${campaignIdStr}`)

      // Unload if empty
      if (room.getClientCount() === 0) {
        setTimeout(async () => {
          if (room.getClientCount() === 0) {
            await room.unload()
            this.rooms.delete(campaignIdStr)
            console.log(`Campaign ${campaignIdStr} fully unloaded`)
          }
        }, 30_000) // grace period
      }
    })
  }

  private createBroadcaster(campaignId: ObjectId, socket: Socket): BroadcastUtils {
    const room = this.rooms.get(campaignId.toString())
    if (!room) throw new Error("Room not found")

    const clientMap = room.clients

    return {
      $all: (e, d) => this.io.to(room.campaignId.toString()).emit(e, d),
      $self: (e, d) => socket.emit(e, d),
      $dm: (e, d) => {
        const dm = room.getDM()
        const dmSid = dm && room.getClientByUserId(dm._id.toString())
        if (!dmSid)
          socket.emit('system-message', {message: {type: 'system', content: 'ГМ не в комнате'}})
        else
          clientMap.forEach((user, sid) => user.role === 'ГМ' && this.io.to(sid).emit(e, d))
      },
      $players: (e, d) => room.clients.forEach((user, sid) => user.role === 'Игрок' && this.io.to(sid).emit(e, d)),
      $player: (userId, e, d) => {
        const target = room.getClientByUserId(userId)
        if (target) this.io.to(target).emit(e, d)
      },
      $requests: () => {
        const queue = [...room.requests.values()]
        clientMap.forEach((user, sid) => {
          const visible = user.role === 'ГМ' ? queue
            : queue.filter(request => request.requester.id === user._id.toString()).map(({content, ...request}) => request)
          this.io.to(sid).emit('requests', {requests: visible})
        })
      }
    }
  }
}