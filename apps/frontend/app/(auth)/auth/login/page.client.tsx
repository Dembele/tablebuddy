'use client'
//Login form: server action sets the cookie; on success go back where the user came from.
import {useActionState, useEffect} from 'react'
import {FaLock, FaUser} from 'react-icons/fa'
import {useRouter, useSearchParams} from "next/navigation"
import Link from "next/link"
import Spinner from "@frontend/components/UI/Spinner"
import IconField from "@frontend/components/UI/IconField"
import {login} from "@frontend/actions/auth"

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {success: false, errors: {}, user: null})
  const router = useRouter()
  const returnTo = useSearchParams().get('returnTo') || '/'

  useEffect(() => {
    if (state.success) {
      router.push(returnTo)
      router.refresh()
    }
  }, [state.success, returnTo, router])

  return (
    <div className="card p-4">
      <h2 className="text-center mb-4">Вход</h2>
      <form action={formAction}>
        {state.errors.global && <div className="alert alert-danger">{state.errors.global}</div>}
        <IconField name="username" label="Логин" icon={<FaUser/>} error={state.errors.username}/>
        <IconField name="password" label="Пароль" type="password" icon={<FaLock/>} error={state.errors.password}/>
        <button disabled={pending} type="submit" className="btn btn-primary w-100">{pending ? <Spinner/> : 'Войти'}</button>
      </form>
      <span className="text-center mt-3">Еще нет учетной записи? <Link href="/auth/register">Зарегистрироваться</Link></span>
    </div>
  )
}
