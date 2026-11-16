//Session cookie options; the name comes from SESS_NAME.
export default function sessionOpts(): {
  name: string
  path: '/',
  sameSite: 'strict',
  httpOnly: true,
  secure: boolean
} {
  const name = process.env.SESS_NAME as string
  const path = '/'
  const sameSite = 'strict'
  const httpOnly = true // This will be included if true
  const secure = process.env.NODE_ENV === 'production' // Use secure cookies in production

  return {name, path, httpOnly, secure, sameSite}
}