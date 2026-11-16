//Backend base URL: BACKEND_API_URL when set, else the backend on this host (containers share the host network) at BACKEND_PORT.
export function backendUrl(): string | undefined {
  if (process.env.BACKEND_API_URL) return process.env.BACKEND_API_URL
  if (process.env.BACKEND_PORT) return `http://localhost:${process.env.BACKEND_PORT}`
  return undefined
}
