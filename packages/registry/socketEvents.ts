import {FChatMessage, SystemMessage} from "../interfaces/DB/Chat"
import {UserSafe} from "../interfaces/DB/User"
import {ObjectId} from "../types/internal/ObjectId"
import {IMap} from "../interfaces/DB/Map"
import {IToken} from "../interfaces/DB/Token"
import {EvaluatedCharacter} from "../interfaces/DB/Character"
import {ActionRequest, RequestSubject, Verdict} from "../interfaces/shared/ActionRequest"
import {ENEquipmentSlot} from "../types/book/items"
import {Adjustment} from "../rules/adjust"
import {TurnOrder} from "../interfaces/shared/TurnOrder"
import {ShopSettings, ShopState} from "../interfaces/shared/Shop"

//who holds a socket in the room right now
export type OnlineUser = Pick<UserSafe, 'username' | 'role'> & { id: string }

export type JoinData = {
  characters: EvaluatedCharacter[]
  messages: FChatMessage[]
  currentMap: IMap | null                                                                                               //a campaign may have no map yet
  turnOrder: TurnOrder
  shop: ShopState
}

export type Rpc = {
  [K in ServerProcedureName]: ServerProcedures[K] extends undefined
    ? () => void
    : (data: ServerProcedures[K]) => void;
}

type SharedHandlers = {
  'reveal-tile': { position: { x: number; y: number } };
  'hide-tile': { position: { x: number; y: number } };
  'toggle-tokens-visibility': { visible: boolean, tokenIds: ObjectId[] };
  'reveal-rect': { minX: number, minY: number, maxX: number, maxY: number };
  'hide-rect': { minX: number, minY: number, maxX: number, maxY: number };
}

//client -> server
export type ServerProcedures = {
  'select-map': { mapId: ObjectId };
  'get-available-maps': undefined;
  'chat-message': { message: string; type?: FChatMessage['type'] };
  'create-token': { characterId: ObjectId; position: { x: number; y: number } };                                      //a template drops a numbered copy instead
  'remove-token': { characterId: ObjectId };                                                                           //DM; a template copy is deleted with its token
  'remove-copies': { templateId: ObjectId };                                                                           //DM: every copy of a template, tokens and sheets
  'draw-line': { from: { x: number; y: number }; to: { x: number; y: number } | null };
  'clear-line': undefined;
  'token-drag-preview': { characterId: ObjectId; to: { x: number; y: number } };
  'move-token-end': { characterId: ObjectId; to: { x: number; y: number } };
  'revalidate-char': { characterId: ObjectId };
  'unequip': { characterId: ObjectId, entryId: string };                                                             //inventory entry id
  'equip': { characterId: ObjectId, entryId: string, slot?: ENEquipmentSlot };                                         //slot defaults to the item's own

  //requests (Doctrine): rolled at request, shown to the DM, spent / posted only on the DM's verdict
  'request': { characterId: ObjectId; subject: RequestSubject }
  'cancel-request': { requestId: string }                                                                              //the requester or the DM
  'verdict': { requestId: string; verdict: Verdict }                                                                   //DM only
  'adjust': { characterId: ObjectId; adjustment: Adjustment }                                                          //DM quick controls: HP, temp HP, conditions, death saves

  //initiative order (rules/turns): the DM's list, every change is a DM press
  'turn-add': { characterIds?: ObjectId[]; custom?: { name: string; hidden?: boolean }; initiative?: number | null }   //characters already listed only take the new number
  'turn-patch': { entryId: string; initiative?: number | null; hidden?: boolean }
  'turn-remove': { entryId: string }
  'turn-step': { direction: 1 | -1 }
  'turn-roll': { entryIds?: string[] }                                                                                 //server rolls initiative for these character lines (default: every unset one); shown in the list only
  'turn-clear': undefined
  'ping': { position: { x: number; y: number } }                                                                       //"look here" on the map, in cells; anyone

  //shop (rules/shop): the DM opens it with a rolled shelf; while open, players buy and sell directly, each deal posted to chat
  'shop-open': ShopSettings                                                                                            //DM: roll a fresh shelf and open (also re-rolls an open one)
  'shop-close': undefined                                                                                              //DM
  'shop-buy': { characterId: ObjectId; entryId: string; quantity: number }
  'shop-sell': { characterId: ObjectId; entryId: string; quantity: number }                                           //inventory entry id; half price, mundane only
} & SharedHandlers;

//server -> client
export type ServerEmitsMap = {
  'draw-line': { from: { x: number; y: number }; to: { x: number; y: number } | null; user: UserSafe; };
  'initial-messages': { messages: FChatMessage[] }
  'chat-message': { message: FChatMessage };
  'system-message': { message: SystemMessage };
  'current-map': { map: IMap | null }
  'map-updated': { mapId: ObjectId }
  'create-token': { token: IToken }
  'remove-token': { characterIds: ObjectId[] }
  'remove-characters': { characterIds: ObjectId[] }                                                                     //deleted template copies
  'set-characters': { characters: EvaluatedCharacter[] }
  'update-character': { character: EvaluatedCharacter | Partial<EvaluatedCharacter> & { _id: ObjectId } }
  'clear-line': { user: UserSafe }
  'token-drag-preview': { characterId: ObjectId, to: { x: number; y: number }, user: UserSafe }
  'token-moved': { characterId: ObjectId, to: { x: number; y: number }, user: UserSafe }
  'requests': { requests: ActionRequest[] }                                                                            //DM: all with dice; player: own, without dice
  'turn-order': { turnOrder: TurnOrder }
  'shop': { shop: ShopState }
  'presence': { users: OnlineUser[] }
  'ping': { position: { x: number; y: number }; user: OnlineUser }

} & SharedHandlers; //+ special 'connect': JoinData

//client calls
export type ServerProcedureName = keyof ServerProcedures;

//server emits
export type ServerEventName = keyof ServerEmitsMap;