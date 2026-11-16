//Shop procedures (rules/shop): the DM opens the campaign's shop with a rolled shelf and closes it; while it is open a player
//buys and sells directly for a character they play (the open shop is the DM's approval), and every deal is posted to chat.
import {randomUUID} from "node:crypto"
import {CampaignRoom, GameHub} from "@backend/events/main"
import {characterManager} from "@backend/services/CharacterManager"
import {getIntroduce, handleMessage} from "@backend/events/_utils/handleMessage"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {ShopSettings} from "@backend/deps/interfaces/shared/Shop"
import {ENItemRarity, itemRarityMap} from "@backend/deps/types/book/items"
import {buy, rollStock, sell, takeStock} from "@backend/deps/rules/shop"
import {itemActions} from "@backend/deps/rules/choices"
import {priceText} from "@backend/deps/rules/coins"

const notice = (content: string) => ({message: {type: 'system' as const, content}})
const maxMagicLimit = 20

//DM: anything; player: owner or listed in usableBy
const mayAccess = (user: UserSafe, character: Pick<ICharacter, 'owner' | 'usableBy'>) =>
  user.role === 'ГМ' || String(character.owner) === String(user._id) || character.usableBy.some(id => String(id) === String(user._id))

//what the DM typed, made sane: a whole cap within reason and a known rarity
const settingsFrom = (data: Partial<ShopSettings>): ShopSettings => ({
  magicLimit: Math.min(maxMagicLimit, Math.max(0, Math.floor(Number(data.magicLimit) || 0))),
  maxRarity: (data.maxRarity && data.maxRarity in itemRarityMap ? data.maxRarity : 'uncommon') as ENItemRarity
})

//a character of this room the user may play, or the reason not
async function shopper(room: CampaignRoom, user: UserSafe, characterId: unknown) {
  const live = await characterManager.getOrCreateCharacter(String(characterId))
  if (String(live.pureData.campaign) !== room.campaignId.toString()) return 'Персонаж из другой кампании'
  if (!mayAccess(user, live.pureData)) return 'Этот персонаж вам недоступен'
  return live
}

//one deal line in chat, from the character
async function postDeal(room: CampaignRoom, user: UserSafe, character: Parameters<typeof getIntroduce>[0], content: string) {
  const message = await handleMessage({
    type: 'chat',
    campaignId: room.campaignId.toString(),
    sender: {_id: user._id, username: user.username, role: user.role},
    introduceAsCharacter: getIntroduce(character),
    content
  })
  room.addMessage(message)
  return message
}

export function registerShopEvents(hub: GameHub) {
  hub.procedure('shop-open', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', notice('Лавку открывает ГМ'))
    const settings = settingsFrom(data ?? {})
    room.shop = {...settings, open: true, entries: rollStock(settings)}
    $all('shop', {shop: room.shop})
  })

  hub.procedure('shop-close', async ({user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', notice('Лавку закрывает ГМ'))
    room.shop = {...room.shop, open: false}
    $all('shop', {shop: room.shop})
  })

  hub.procedure('shop-buy', async ({data, user, room, $all, $self}) => {
    if (!room.shop.open) return $self('system-message', notice('Лавка закрыта'))
    const live = await shopper(room, user, data.characterId)
    if (typeof live === 'string') return $self('system-message', notice(live))
    const entry = room.shop.entries.find((candidate) => candidate.id === data.entryId)
    if (!entry) return $self('system-message', notice('Этого больше нет в лавке'))

    const quantity = Number(data.quantity)
    const outcome = buy(live.pureData as ICharacter, entry, quantity, randomUUID().slice(0, 8))
    if (!outcome.ok) return $self('system-message', notice(outcome.reason))
    room.shop = {...room.shop, entries: takeStock(room.shop.entries, entry.id, quantity)}
    await live.setProperty('currency', outcome.value.currency)
    await live.setProperty('inventory', outcome.value.inventory)
    $all('update-character', {character: await live.setProperty('actions', itemActions(live.pureData as ICharacter, outcome.value.inventory))})
    $all('shop', {shop: room.shop})
    const message = await postDeal(room, user, live.evaluatedData, `купил(а) в лавке: ${entry.name}${quantity > 1 ? ` ×${quantity}` : ''} — ${priceText(entry.price * quantity)}`)
    $all('chat-message', {message})
  })

  hub.procedure('shop-sell', async ({data, user, room, $all, $self}) => {
    if (!room.shop.open) return $self('system-message', notice('Лавка закрыта'))
    const live = await shopper(room, user, data.characterId)
    if (typeof live === 'string') return $self('system-message', notice(live))

    const quantity = Number(data.quantity)
    const outcome = sell(live.pureData as ICharacter, data.entryId, quantity)
    if (!outcome.ok) return $self('system-message', notice(outcome.reason))
    await live.setProperty('currency', outcome.value.currency)
    await live.setProperty('inventory', outcome.value.inventory)
    $all('update-character', {character: await live.setProperty('actions', itemActions(live.pureData as ICharacter, outcome.value.inventory))})
    const message = await postDeal(room, user, live.evaluatedData, `продал(а) в лавку: ${outcome.value.name}${quantity > 1 ? ` ×${quantity}` : ''} — ${priceText(outcome.value.earned)}`)
    $all('chat-message', {message})
  })
}
