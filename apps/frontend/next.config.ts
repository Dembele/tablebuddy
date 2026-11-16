//Next config: @frontend alias, /api + /uploads proxied to the backend. Styles: globals.scss is compiled by the IDE.
//Root = repo root: deps/ is a symlink to ../../packages and Turbopack refuses files outside its root.
import path from "path"
import type {NextConfig} from "next"
import {backendUrl} from "./_util/backendUrl"

const repoRoot = path.resolve(__dirname, "../..")

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
    resolveAlias: {"@frontend": path.resolve(__dirname, ".")}
  },
  outputFileTracingRoot: repoRoot,

  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean), //next dev blocks other hosts' dev assets / HMR; comma-separated hosts

  async rewrites() {
    const backend = backendUrl()
    if (!backend) {
      console.warn('Neither BACKEND_API_URL nor BACKEND_PORT is set')
      return []
    }
    return [
      {source: '/api/:path*', destination: `${backend}/:path*`},
      {source: '/uploads/:path*', destination: `${backend}/uploads/:path*`}
    ]
  },

  experimental: {serverActions: {bodySizeLimit: '10mb'}}
}

export default nextConfig
