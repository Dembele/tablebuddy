'use client'
//Joins the campaign room for the page (store/room.ts holds the socket and state); sheet pages refresh on character updates.
import {createContext, ReactNode, useContext, useEffect} from "react"
import {useRouter} from "next/navigation"
import {useShallow} from "zustand/react/shallow"
import {onCharacterUpdate, RoomUser, useRoomStore} from "@frontend/store/room"

const InRoom = createContext(false)

//request queue + notices for buttons and the dock; null outside a provider
export function useRoom() {
  const inRoom = useContext(InRoom)
  const room = useRoomStore(useShallow((state) => ({
    connected: state.connected, requests: state.requests, messages: state.messages, notices: state.notices,
    request: state.request, cancel: state.cancel, verdict: state.verdict, dismissNotice: state.dismissNotice,
    isDM: state.user?.role === 'ГМ'
  })))
  return inRoom ? room : null
}

interface RoomProviderProps {
  campaignId: string
  user: RoomUser
  refreshOnUpdate?: boolean                                                                                             //server-rendered sheets re-render when a character changes
  children: ReactNode
}

export default function RoomProvider({campaignId, user, refreshOnUpdate = true, children}: RoomProviderProps) {
  const router = useRouter()
  const connect = useRoomStore((state) => state.connect)
  const disconnect = useRoomStore((state) => state.disconnect)

  useEffect(() => {
    connect(campaignId, user)
    return () => disconnect()
  }, [campaignId, user.id, user.role, user.username, connect, disconnect])                                                // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshOnUpdate) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = onCharacterUpdate(() => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 150)                                                                   //verdicts write several fields in a row
    })
    return () => { clearTimeout(timer); stop() }
  }, [refreshOnUpdate, router])

  return <InRoom.Provider value={true}>{children}</InRoom.Provider>
}
