'use client'
//A request button: one subject sends at once; several (cost choices computed on the server) open an inline pick.
import {ReactNode, useState} from "react"
import type {RequestSubject} from "@frontend/deps/interfaces/shared/ActionRequest"
import {useRoom} from "@frontend/components/Room/RoomProvider"

export interface SubjectChoice {
  label: string
  subject: RequestSubject
}

interface RequestButtonProps {
  characterId: string
  choices: SubjectChoice[]
  children: ReactNode
  className?: string
  title?: string
  loading?: boolean                                                                                                     //choices still on their way from the server
}

export default function RequestButton({characterId, choices, children, className = 'btn btn-sm btn-outline-primary py-0 px-1', title, loading}: RequestButtonProps) {
  const room = useRoom()
  const [picking, setPicking] = useState(false)
  if (!room) return <span>{children}</span>                                                                               //outside a room: plain text
  const unavailable = !room.connected ? 'Нет соединения с комнатой' : loading ? 'Загрузка вариантов…' : choices.length === 0 ? 'Нечем оплатить' : undefined

  const send = (subject: RequestSubject) => { room.request(characterId, subject); setPicking(false) }
  const press = () => choices.length === 1 ? send(choices[0].subject) : setPicking((open) => !open)

  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-1">
      <button type="button" className={className} disabled={!!unavailable} title={unavailable ?? title} aria-expanded={choices.length > 1 ? picking : undefined} onClick={press}>{children}</button>
      {picking && choices.map((choice, index) => (
        <button key={index} type="button" className="btn btn-sm btn-outline-secondary py-0 px-1" onClick={() => send(choice.subject)}>{choice.label}</button>
      ))}
    </span>
  )
}
