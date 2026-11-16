import {hashSync} from "bcrypt"

export function createSession(email: string, password: string) {
  return hashSync(String(email) + String(password) + Date.now().toString(), 10)
}

export function sessionOpts(): {
  expires: Date,
  path: '/',
  sameSite: 'strict',
  httpOnly: true,
  secure: boolean
} {
  const expires = new Date(Date.now() + parseInt(process.env.SESS_LIFETIME as string, 10))
  const path = '/'
  const sameSite = 'strict'
  const httpOnly = true
  const secure = process.env.NODE_ENV === 'production'

  return {expires, path, httpOnly, secure, sameSite}
}