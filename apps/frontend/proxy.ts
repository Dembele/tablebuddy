//Next proxy (ex-middleware): only tags each page request with its own path, so server code can say where the user was going
//(maintenance «back» link, login returnTo). No auth here — session checks live with the pages (_util/session).
import {NextRequest, NextResponse} from "next/server"

export const pathHeader = 'x-tablebuddy-path'

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set(pathHeader, `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.next({request: {headers}})
}

//pages only: not Next assets, the backend rewrite, or files with an extension
export const config = {matcher: ['/((?!_next/|api/|.*\\.).*)']}
