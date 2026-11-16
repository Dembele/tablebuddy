'use client'
//Register form: server action creates the user and the session cookie, then home.
import {useActionState, useEffect} from 'react'
import {FaKey, FaLock, FaUser} from 'react-icons/fa'
import {useRouter} from "next/navigation"
import Link from "next/link"
import Spinner from "@frontend/components/UI/Spinner"
import IconField from "@frontend/components/UI/IconField"
import {register} from "@frontend/actions/auth"

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, {success: false, errors: {}, user: null})
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      router.push('/')
      router.refresh()
    }
  }, [state.success, router])

  return (
    <div className="card p-4">
      <h2 className="text-center mb-4">Регистрация</h2>
      <form action={formAction}>
        {state.errors.global && <div className="alert alert-danger">{state.errors.global}</div>}
        <IconField name="username" label="Логин" icon={<FaUser/>} error={state.errors.username}/>
        <IconField name="password" label="Пароль" type="password" icon={<FaLock/>} error={state.errors.password}/>
        <IconField name="password2" label="Повторите пароль" type="password" icon={<FaLock/>}/>
        <IconField name="code" label="Код приглашения (от ГМ)" icon={<FaKey/>}/>
        <button disabled={pending} type="submit" className="btn btn-primary w-100">{pending ? <Spinner/> : 'Зарегистрироваться'}</button>
      </form>
      <span className="text-center mt-3">Уже есть учетная запись? <Link href="/auth/login">Войти</Link></span>
    </div>
  )
}
