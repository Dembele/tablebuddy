'use client'
//Shop tab of the game room (rules/shop): the DM opens it with a magic-item cap and a rarity ceiling — the server rolls the shelf —
//and closes it. While it is open the acting character (as in the action panel) buys from the shelf and sells unequipped mundane
//items at half price (treasure at full); the server checks the purse and posts every deal to chat. Ammunition is bought by the pack of 20.
import {useEffect, useState} from "react"
import {FaCoins, FaDice, FaLock} from "react-icons/fa6"
import {GiSparkles} from "react-icons/gi"
import {useRoomStore} from "@frontend/store/room"
import {useGameUI} from "@frontend/components/Game/GameUI"
import {useActiveCharacter} from "@frontend/components/Game/ActionPanel"
import {SellOffer, sellOffers} from "@frontend/actions/room"
import type {ShopEntry} from "@frontend/deps/interfaces/shared/Shop"
import type {ENItemRarity} from "@frontend/deps/types/book/items"
import {priceText, purseValue} from "@frontend/deps/rules/coins"
import {rarityNames} from "@frontend/_util/labels"

const coinOrder = [['platinum', 'ПМ'], ['gold', 'ЗМ'], ['electrum', 'ЭМ'], ['silver', 'СМ'], ['copper', 'ММ']] as const
const packOf = (entry: ShopEntry) => entry.type === 'ammo' ? 20 : 1

//DM: cap + rarity, open (or re-roll) and close
function ShopControls() {
  const shop = useRoomStore((state) => state.shop)
  const emit = useRoomStore((state) => state.emit)
  const [magicLimit, setMagicLimit] = useState(shop.magicLimit)
  const [maxRarity, setMaxRarity] = useState<ENItemRarity>(shop.maxRarity)

  return (
    <div className="tb-section">
      <div className="d-flex flex-wrap align-items-end gap-2">
        <label className="small">Магических, не больше
          <input type="number" min={0} max={20} className="form-control form-control-sm" value={magicLimit} onChange={(event) => setMagicLimit(Number(event.target.value))}/>
        </label>
        <label className="small">Редкость до
          <select className="form-select form-select-sm" value={maxRarity} onChange={(event) => setMaxRarity(event.target.value as ENItemRarity)}>
            {Object.entries(rarityNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={() => emit('shop-open', {magicLimit, maxRarity})}>
          <FaDice/>{shop.open ? 'Перебросить товар' : 'Открыть лавку'}
        </button>
        {shop.open && <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => emit('shop-close', undefined)}><FaLock/>Закрыть</button>}
      </div>
    </div>
  )
}

export default function ShopPanel() {
  const shop = useRoomStore((state) => state.shop)
  const emit = useRoomStore((state) => state.emit)
  const {act, open} = useGameUI()
  const {user, isDM, own, fromSelection, activeId, character} = useActiveCharacter()
  const [filter, setFilter] = useState('')
  const [offers, setOffers] = useState<{ id: string; list: SellOffer[] } | null>(null)

  //sell prices follow the sheet: asked again whenever the room pushes a new snapshot of this character
  useEffect(() => {
    if (!activeId || !shop.open) return
    let stale = false
    const timer = setTimeout(async () => {
      const {data} = await sellOffers(activeId)
      if (!stale && data) setOffers({id: activeId, list: data})
    }, 200)
    return () => { stale = true; clearTimeout(timer) }
  }, [activeId, character, shop.open])

  if (!user) return null
  const controls = isDM && <ShopControls/>
  if (!shop.open) return <>{controls}<div className="tb-empty">Лавка закрыта. {isDM ? 'Откройте её — товар разыграется заново.' : 'Её открывает ГМ: в городе или перед кампанией.'}</div></>
  if (!character || !activeId) return <>{controls}<div className="tb-empty">{isDM ? 'Выберите фишку или персонажа в «Отряде», чтобы купить за него.' : 'У вас пока нет персонажа в этой кампании.'}</div></>

  const purse = purseValue(character.currency)
  const needle = filter.trim().toLowerCase()
  const shown = shop.entries.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
  const sellable = offers?.id === activeId ? offers.list.filter((offer) => !needle || offer.name.toLowerCase().includes(needle)) : []

  const row = (entry: ShopEntry) => {
    const pack = packOf(entry)
    const cost = entry.price * pack
    return (
      <div key={entry.id} className="d-flex align-items-center gap-2 py-1 border-bottom border-secondary-subtle">
        <button type="button" className="btn btn-link btn-sm p-0 text-start text-reset flex-grow-1 text-truncate" title="Описание в справочнике"
                onClick={() => open(`/compendium/items/${entry.item}`, entry.name)}>
          {entry.magic && <GiSparkles className="text-warning me-1"/>}{entry.name}{pack > 1 && <span className="text-muted"> ×{pack}</span>}
          {entry.magic && <span className="text-muted small"> · {rarityNames[entry.rarity]}</span>}
        </button>
        <span className="small text-muted text-nowrap">{priceText(cost)}</span>
        <button type="button" className="btn btn-sm btn-outline-primary py-0" disabled={cost > purse} title={cost > purse ? 'Не хватает денег' : undefined}
                onClick={() => emit('shop-buy', {characterId: activeId, entryId: entry.id, quantity: pack})}>Купить</button>
      </div>
    )
  }

  return (
    <div className="actions">
      {controls}
      <div className="d-flex align-items-center gap-2">
        <FaCoins className="text-warning"/>
        <b className="flex-grow-1 text-truncate">{character.name}</b>
        <span className="small text-nowrap">{coinOrder.filter(([coin]) => character.currency[coin] > 0).map(([coin, label]) => `${character.currency[coin]} ${label}`).join(' · ') || 'без денег'}</span>
      </div>
      {own.length > 1 && !fromSelection && (
        <select className="form-select form-select-sm" value={activeId} onChange={(event) => act(event.target.value)} aria-label="За кого покупать">
          {own.map((entry) => <option key={String(entry._id)} value={String(entry._id)}>{entry.name}</option>)}
        </select>
      )}
      <input className="form-control form-control-sm" placeholder="Поиск по лавке и сумке" value={filter} onChange={(event) => setFilter(event.target.value)}/>

      {shown.some((entry) => entry.magic) && (
        <details className="tb-section" open>
          <summary><span className="tb-eyebrow">Магические предметы</span></summary>
          {shown.filter((entry) => entry.magic).map(row)}
        </details>
      )}
      <details className="tb-section" open>
        <summary><span className="tb-eyebrow">Снаряжение</span></summary>
        {shown.filter((entry) => !entry.magic).map(row)}
        {!shown.some((entry) => !entry.magic) && <div className="small text-muted">Ничего не нашлось.</div>}
      </details>

      <details className="tb-section">
        <summary><span className="tb-eyebrow">Продать (половина цены, сокровища — полная)</span></summary>
        {sellable.map((offer) => (
          <div key={offer.entryId} className="d-flex align-items-center gap-2 py-1 border-bottom border-secondary-subtle">
            <span className="flex-grow-1 small text-truncate">{offer.name}{offer.quantity > 1 && <span className="text-muted"> ×{offer.quantity}</span>}</span>
            <span className="small text-muted text-nowrap">{priceText(offer.each)}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => emit('shop-sell', {characterId: activeId, entryId: offer.entryId, quantity: 1})}>Продать</button>
            {offer.quantity > 1 && <button type="button" className="btn btn-sm btn-outline-secondary py-0" title={`Все за ${priceText(offer.each * offer.quantity)}`}
                                           onClick={() => emit('shop-sell', {characterId: activeId, entryId: offer.entryId, quantity: offer.quantity})}>Все</button>}
          </div>
        ))}
        {!sellable.length && <div className="small text-muted">Нечего продать: только неэкипированное снаряжение; магию покупает ГМ.</div>}
      </details>
    </div>
  )
}
