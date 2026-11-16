// Server-side session gates for RSC pages; takes over the auth logic proxy.ts used to hold.
import 'server-only'

import {cookies, headers} from "next/headers"
import {redirect} from "next/navigation"
import sessionOpts from "@frontend/_util/sessionOpts"
import {identifyUser} from "@frontend/actions/auth"
import {ApiResponse} from "@frontend/deps/types/internal/ApiResponse"
import {UserSafe} from "@frontend/deps/interfaces/DB/User"
import {pathHeader} from "@frontend/proxy"

// Dedupes concurrent gate calls within one render: a single /auth/ round-trip per token.
const inFlight = new Map<string, Promise<ApiResponse<UserSafe>>>()

function loginUrl(returnTo?: string): string {
  if (!returnTo) return '/auth/login'
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}

async function fetchSessionUser(token: string): Promise<ApiResponse<UserSafe>> {
  const pending = inFlight.get(token)
  if (pending) return pending

  const request = identifyUser().finally(() => inFlight.delete(token))
  inFlight.set(token, request)
  return await request
}

//the page the user asked for (set by proxy.ts), for coming back after login or maintenance
async function requestedPath(): Promise<string | undefined> {
  const path = (await headers()).get(pathHeader) ?? undefined
  return path?.startsWith('/') && !path.startsWith('//') && !path.startsWith('/maintenance') && !path.startsWith('/auth') ? path : undefined
}

// Redirects when the session is missing or dead; returns the user otherwise.
export async function requireUser(returnTo?: string): Promise<UserSafe> {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionOpts().name)?.value
  const comeBack = returnTo ?? await requestedPath()
  if (!token) redirect(loginUrl(comeBack))

  const {data, statusCode} = await fetchSessionUser(token)
  // Backend unreachable - the maintenance page must stay reachable without a session; it links back to where the user was going.
  if (statusCode >= 500 && !data) redirect(comeBack ? `/maintenance?from=${encodeURIComponent(comeBack)}` : '/maintenance')
  if (!data) {
    cookieStore.delete(sessionOpts().name)
    redirect(loginUrl(comeBack))
  }

  return data
}

// GM-only gate for /admin; bounces everyone else home.
export async function requireAdmin(): Promise<UserSafe> {
  const user = await requireUser()
  if (user.role !== 'ГМ') redirect('/')
  return user
}

// Auth pages must stay reachable only for guests - mirrors the old proxy bounce.
export async function assertGuest(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionOpts().name)?.value
  if (token) redirect('/')
}
