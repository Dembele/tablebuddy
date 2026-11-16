'use client'
//Game room UI context: which side tab is open, whose actions the action panel shows, the drawer that opens site pages
//(sheet, editor, compendium) inside the room, and the bestiary summary for the DM's picker.
//Pages in the drawer are the normal routes in an iframe, without the site header.
import {createContext, ReactNode, useContext, useState} from "react"
import {FaArrowUpRightFromSquare, FaDownLeftAndUpRightToCenter, FaUpRightAndDownLeftFromCenter, FaXmark} from "react-icons/fa6"
import IconButton from "@frontend/components/UI/IconButton"

export interface MonsterSummary { id: string; name: string; rating: string; type: string }
export type SideTab = 'chat' | 'actions' | 'party' | 'shop'
interface Drawer { url: string; title: string }

interface GameUI {
  campaignId: string
  monsters: MonsterSummary[]                                                                                            //DM only; empty for players
  tab: SideTab
  setTab: (tab: SideTab) => void
  actor: string | null                                                                                                  //character picked for the action panel (a selected token wins over it)
  act: (characterId: string) => void                                                                                    //pick + show the action panel
  open: (url: string, title: string) => void
}

const Context = createContext<GameUI | null>(null)

export function useGameUI(): GameUI {
  const value = useContext(Context)
  if (!value) throw new Error('useGameUI outside the game room')
  return value
}

//drag payload between the party panel / bestiary picker and the canvas
export const dragType = 'application/x-tablebuddy'
export type DragPayload = { kind: 'character'; id: string } | { kind: 'monster'; id: string }

export function GameUIProvider({campaignId, monsters, children}: { campaignId: string; monsters: MonsterSummary[]; children: ReactNode }) {
  const [drawer, setDrawer] = useState<Drawer | null>(null)
  const [wide, setWide] = useState(false)
  const [tab, setTab] = useState<SideTab>('chat')
  const [actor, setActor] = useState<string | null>(null)
  const act = (characterId: string) => { setActor(characterId); setTab('actions') }

  return (
    <Context.Provider value={{campaignId, monsters, tab, setTab, actor, act, open: (url, title) => setDrawer({url, title})}}>
      {children}
      {drawer && (
        <aside className={`room__drawer ${wide ? 'is-wide' : ''}`}>
          <div className="room__drawer-bar">
            <b className="flex-grow-1 text-truncate tb-title">{drawer.title}</b>
            <IconButton size="sm" label={wide ? 'Уже' : 'Шире'} icon={wide ? <FaDownLeftAndUpRightToCenter/> : <FaUpRightAndDownLeftFromCenter/>} onClick={() => setWide((current) => !current)}/>
            <a href={drawer.url} target="_blank" rel="noreferrer" className="tb-icon-btn tb-icon-btn--sm" title="Открыть в новой вкладке" aria-label="Открыть в новой вкладке"><FaArrowUpRightFromSquare/></a>
            <IconButton size="sm" label="Закрыть" icon={<FaXmark/>} onClick={() => setDrawer(null)}/>
          </div>
          <iframe key={drawer.url} src={drawer.url} title={drawer.title}/>
        </aside>
      )}
    </Context.Provider>
  )
}
