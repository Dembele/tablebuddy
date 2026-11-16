'use client'
//One user row's DM buttons: role switch, password reset (inline field).
import {useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {resetUserPassword, setUserRole} from "@frontend/actions/campaigns"
import Spinner from "@frontend/components/UI/Spinner"

export default function UserButtons({userId, role}: { userId: string; role: 'ГМ' | 'Игрок' }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [password, setPassword] = useState('')
  const router = useRouter()
  const next = role === 'ГМ' ? 'Игрок' : 'ГМ'

  const run = (action: () => Promise<{ isSuccess: boolean; message: string }>, success: string, refresh = false) => startTransition(async () => {
    setError(null)
    setNotice(null)
    const {isSuccess, message} = await action()
    if (!isSuccess) return setError(message)
    setNotice(success)
    setResetting(false)
    setPassword('')
    if (refresh) router.refresh()
  })

  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-1 small">
      <button type="button" className="btn btn-sm btn-outline-light py-0" disabled={pending} onClick={() => run(() => setUserRole(userId, next), 'Роль изменена', true)}>
        {next === 'ГМ' ? 'Сделать ГМ' : 'Сделать игроком'}
      </button>
      {!resetting && <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => setResetting(true)}>Сбросить пароль</button>}
      {resetting && (
        <>
          <input type="text" className="form-control form-control-sm py-0" style={{width: 160}} placeholder="Новый пароль" value={password} onChange={(event) => setPassword(event.target.value)}/>
          <button type="button" className="btn btn-sm btn-warning py-0" disabled={pending || !password} onClick={() => run(() => resetUserPassword(userId, password), 'Пароль сброшен')}>Задать</button>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => { setResetting(false); setPassword('') }}>Отмена</button>
        </>
      )}
      {pending && <Spinner/>}
      {notice && <span className="text-success">{notice}</span>}
      {error && <span className="text-danger">{error}</span>}
    </span>
  )
}
