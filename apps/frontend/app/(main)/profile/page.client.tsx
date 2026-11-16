'use client'
//Password change form: current + new twice; on success other sessions end.
import {FormEvent, useState, useTransition} from "react"
import {changePassword} from "@frontend/actions/auth"
import Spinner from "@frontend/components/UI/Spinner"

export default function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setDone(false)
    if (next !== repeat) return setError('Новые пароли не совпадают')
    startTransition(async () => {
      setError(null)
      const {isSuccess, message} = await changePassword(current, next)
      if (!isSuccess) return setError(message)
      setDone(true)
      setCurrent(''); setNext(''); setRepeat('')
    })
  }

  return (
    <form onSubmit={submit} className="small">
      <label className="form-label w-100">Текущий пароль
        <input type="password" autoComplete="current-password" className="form-control form-control-sm" value={current} onChange={(event) => setCurrent(event.target.value)}/>
      </label>
      <label className="form-label w-100">Новый пароль
        <input type="password" autoComplete="new-password" className="form-control form-control-sm" value={next} onChange={(event) => setNext(event.target.value)}/>
      </label>
      <label className="form-label w-100">Новый пароль ещё раз
        <input type="password" autoComplete="new-password" className="form-control form-control-sm" value={repeat} onChange={(event) => setRepeat(event.target.value)}/>
      </label>
      <div className="d-flex align-items-center gap-2">
        <button type="submit" className="btn btn-sm btn-primary" disabled={pending || !current || !next}>{pending ? <Spinner/> : 'Сменить пароль'}</button>
        {done && <span className="text-success">Пароль изменён, другие сеансы завершены</span>}
        {error && <span className="text-danger">{error}</span>}
      </div>
    </form>
  )
}
