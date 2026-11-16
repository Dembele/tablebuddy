'use client'
//Game room: the bar (tools, initiative switch, who is online, DM map switch), the side panel (chat with pinned requests / actions / party /
//shop while open), the map as the stage with the initiative order, selection card and notices floating over it. Joins the room itself.
//Site pages (sheets, editor, compendium, maps) open in a drawer over the room; the DM drags characters and bestiary monsters onto the map.
import Link from "next/link"
import {ReactNode, useEffect, useState, useTransition} from "react"
import {FaArrowLeft, FaArrowPointer, FaBars, FaBookOpen, FaCircleQuestion, FaComments, FaDiceD20, FaGear, FaMapLocationDot, FaRulerCombined, FaSmog, FaUsers, FaXmark} from "react-icons/fa6"
import {GiCrossedSwords, GiShop} from "react-icons/gi"
import {useRoomStore, CanvasTool, RoomUser} from "@frontend/store/room"
import RoomProvider from "@frontend/components/Room/RoomProvider"
import MapCanvas from "@frontend/components/Game/Canvas/MapCanvas"
import {ChatPanel, PartyPanel, SelectionCard} from "@frontend/components/Game/Panels"
import ActionPanel from "@frontend/components/Game/ActionPanel"
import ShopPanel from "@frontend/components/Game/ShopPanel"
import TurnTracker from "@frontend/components/Game/TurnTracker"
import {setCurrentMap} from "@frontend/actions/maps"
import {GameUIProvider, MonsterSummary, SideTab, useGameUI} from "@frontend/components/Game/GameUI"
import IconButton from "@frontend/components/UI/IconButton"
import Avatar from "@frontend/components/UI/Avatar"

interface GameRoomProps {
  campaign: { id: string; name: string }
  user: RoomUser
  maps: Array<{ id: string; name: string }>                                                                             //DM: the campaign's maps
  monsters: MonsterSummary[]                                                                                            //DM: the bestiary for the picker
}

const tools: Array<{ id: CanvasTool; icon: ReactNode; title: string; dmOnly?: boolean }> = [
  {id: 'pointer', icon: <FaArrowPointer/>, title: 'Указатель: выбор и перемещение фишек'},
  {id: 'ruler', icon: <FaRulerCombined/>, title: 'Линейка (или правая кнопка мыши)'},
  {id: 'vision', icon: <FaSmog/>, title: 'Туман войны: клик — клетка, протяжка — область (или Shift)', dmOnly: true}
]

const gestures: Array<[string, string]> = [
  ['Тянуть карту', 'сдвиг; колесо или щипок — масштаб'],
  ['Клик по фишке', 'выбор; Ctrl / Shift — добавить к выбору'],
  ['Тянуть фишку', 'переместить (всю выбранную группу)'],
  ['Двойной клик', 'по своей фишке — лист; по карте — метка «смотрите сюда»'],
  ['Alt + клик', 'метка в любой точке'],
  ['Правая кнопка', 'линейка с расстоянием']
]

interface BarProps extends Pick<GameRoomProps, 'campaign' | 'maps'> {
  sidebar: boolean
  toggleSidebar: () => void
  tracker: boolean
  toggleTracker: () => void
}

function TopBar({campaign, maps, sidebar, toggleSidebar, tracker, toggleTracker}: BarProps) {
  const connected = useRoomStore((state) => state.connected)
  const isDM = useRoomStore((state) => state.user?.role === 'ГМ')
  const tool = useRoomStore((state) => state.tool)
  const setTool = useRoomStore((state) => state.setTool)
  const map = useRoomStore((state) => state.map)
  const notify = useRoomStore((state) => state.notify)
  const online = useRoomStore((state) => state.online)
  const fighting = useRoomStore((state) => state.turnOrder.entries.length > 0)
  const [pending, startTransition] = useTransition()
  const [help, setHelp] = useState(false)
  const {open} = useGameUI()

  const switchMap = (mapId: string) => startTransition(async () => {
    const {isSuccess, message} = await setCurrentMap(campaign.id, mapId || null)
    if (!isSuccess) notify(message)
  })

  return (
    <header className="room__bar">
      <IconButton label={sidebar ? 'Скрыть панель' : 'Показать панель'} icon={<FaBars/>} active={sidebar} onClick={toggleSidebar}/>
      <Link href={`/campaigns/${campaign.id}`} className="tb-icon-btn" title="Выйти из комнаты к странице кампании" aria-label="К странице кампании"><FaArrowLeft/></Link>
      <span className="room__title" title={campaign.name}>{campaign.name}</span>
      <span className={`tb-dot ${connected ? 'is-on' : ''}`} title={connected ? 'Вы в комнате' : 'Нет соединения — переподключение…'} role="status" aria-label={connected ? 'Соединение есть' : 'Нет соединения'}/>

      <div className="tb-group ms-2" role="toolbar" aria-label="Инструменты карты">
        {tools.filter((entry) => !entry.dmOnly || isDM).map((entry) => (
          <IconButton key={entry.id} label={entry.title} icon={entry.icon} active={tool === entry.id} onClick={() => setTool(entry.id)}/>
        ))}
      </div>
      <IconButton label={tracker ? 'Скрыть порядок ходов' : fighting ? 'Порядок ходов (идёт бой)' : 'Порядок ходов'} icon={<GiCrossedSwords/>} active={tracker} onClick={toggleTracker}/>

      <span className="room__spacer"/>

      <div className="room__presence" aria-label="Сейчас в комнате">
        {online.map((peer) => <Avatar key={peer.id} name={peer.username} tone={peer.role === 'ГМ' ? 'dm' : 'player'} title={`${peer.username} · ${peer.role} · в комнате`}/>)}
      </div>
      <IconButton label="Управление картой" icon={<FaCircleQuestion/>} active={help} onClick={() => setHelp((current) => !current)}/>
      <IconButton label="Справочник поверх комнаты" icon={<FaBookOpen/>} onClick={() => open('/compendium', 'Справочник')}/>
      {isDM && <IconButton label="Кампания: персонажи, карты, настройки" icon={<FaGear/>} onClick={() => open(`/campaigns/${campaign.id}`, campaign.name)}/>}
      {isDM && map && <IconButton label="Править текущую карту (сетка, туман)" icon={<FaMapLocationDot/>} onClick={() => open(`/campaigns/${campaign.id}/maps/${map._id}`, `Карта: ${map.name}`)}/>}
      {isDM && (
        <select className="form-select form-select-sm w-auto flex-shrink-0" style={{maxWidth: 200}} value={map ? String(map._id) : ''} disabled={pending} onChange={(event) => switchMap(event.target.value)} aria-label="Карта в игре">
          <option value="">— без карты —</option>
          {maps.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      )}
      {help && (
        <div className="tb-float position-fixed p-3" style={{top: 56, right: 8, zIndex: 50, width: 'min(380px, calc(100vw - 16px))'}} role="dialog" aria-label="Управление картой">
          <div className="d-flex align-items-center mb-2">
            <b className="tb-title flex-grow-1">Управление картой</b>
            <IconButton size="sm" label="Закрыть" icon={<FaXmark/>} onClick={() => setHelp(false)}/>
          </div>
          <dl className="mb-0">
            {gestures.map(([gesture, effect]) => <div key={gesture} className="d-flex gap-2 mb-1"><dt style={{minWidth: 118}}>{gesture}</dt><dd className="mb-0 text-muted">{effect}</dd></div>)}
            {isDM && <div className="d-flex gap-2"><dt style={{minWidth: 118}}>Shift + клик</dt><dd className="mb-0 text-muted">открыть / скрыть туман; протяжка — область</dd></div>}
          </dl>
        </div>
      )}
    </header>
  )
}

function Notices() {
  const notices = useRoomStore((state) => state.notices)
  const dismiss = useRoomStore((state) => state.dismissNotice)
  if (!notices.length) return null
  return (
    <div className="room__toasts" role="status">
      {notices.map((notice, index) => (
        <div key={index} className="tb-toast">
          <span className="flex-grow-1">{notice}</span>
          <IconButton size="sm" label="Закрыть" icon={<FaXmark/>} onClick={() => dismiss(index)}/>
        </div>
      ))}
    </div>
  )
}

function Sidebar() {
  const {tab, setTab} = useGameUI()
  const requestCount = useRoomStore((state) => state.requests.length)
  const shopOpen = useRoomStore((state) => state.shop.open)
  const isDM = useRoomStore((state) => state.user?.role === 'ГМ')
  const shopShown = shopOpen || isDM                                                                                    //players see the shop only while the DM keeps it open
  const tabs: Array<[SideTab, string, ReactNode]> = [['chat', 'Чат', <FaComments key="chat"/>], ['actions', 'Действия', <FaDiceD20 key="actions"/>], ['party', 'Отряд', <FaUsers key="party"/>],
    ...(shopShown ? [['shop', 'Лавка', <GiShop key="shop"/>] as [SideTab, string, ReactNode]] : [])]
  const current = tab === 'shop' && !shopShown ? 'chat' : tab                                                          //the shop closed under a player: back to chat

  return (
    <aside className="room__side">
      <div className="room__tabs">
        <div className="tb-tabs" role="tablist">
          {tabs.map(([id, title, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={current === id} className={current === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              {icon}{title}{id === 'chat' && requestCount > 0 && <span className="tb-count" title="Запросы ждут решения">{requestCount}</span>}
              {id === 'shop' && shopOpen && <span className="tb-dot is-on ms-1" title="Лавка открыта"/>}
            </button>
          ))}
        </div>
      </div>
      <div className="room__panel">
        {current === 'chat' && <ChatPanel/>}
        {current === 'actions' && <ActionPanel/>}
        {current === 'party' && <PartyPanel/>}
        {current === 'shop' && <ShopPanel/>}
      </div>
    </aside>
  )
}

function Room({campaign, maps}: Pick<GameRoomProps, 'campaign' | 'maps'>) {
  const [sidebar, setSidebar] = useState(true)
  const [trackerChoice, setTrackerChoice] = useState<boolean | null>(null)                                              //null = follow the list: shown while it has lines
  const fighting = useRoomStore((state) => state.turnOrder.entries.length > 0)
  const tracker = trackerChoice ?? fighting

  useEffect(() => { if (window.matchMedia('(max-width: 767.98px)').matches) setSidebar(false) }, [])                      //phones start on the map

  return (
    <div className="room">
      <TopBar campaign={campaign} maps={maps} sidebar={sidebar} toggleSidebar={() => setSidebar((current) => !current)}
              tracker={tracker} toggleTracker={() => setTrackerChoice(!tracker)}/>
      <div className="room__body">
        {sidebar && <Sidebar/>}
        <div className="room__stage">
          <MapCanvas/>
          {tracker && <TurnTracker onClose={() => setTrackerChoice(false)}/>}
          <SelectionCard/>
          <Notices/>
        </div>
      </div>
    </div>
  )
}

export default function GameRoom({campaign, user, maps, monsters}: GameRoomProps) {
  return (
    <RoomProvider campaignId={campaign.id} user={user} refreshOnUpdate={false}>
      <GameUIProvider campaignId={campaign.id} monsters={monsters}>
        <Room campaign={campaign} maps={maps}/>
      </GameUIProvider>
    </RoomProvider>
  )
}
