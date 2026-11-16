//One-time socket tickets: REST (session-checked) issues one for a campaign room, the socket handshake redeems it.
//The httpOnly session cookie never reaches browser JS, and the socket never trusts a user the client claims to be.
import {randomBytes} from "node:crypto"
import {UserSafe} from "@backend/deps/interfaces/DB/User"

const lifetimeMs = 60_000

interface Ticket {
  user: UserSafe
  campaignId: string
  expires: number
}

const tickets = new Map<string, Ticket>()

//new ticket for this user and room; stale ones are swept on the way
export function issueTicket(user: UserSafe, campaignId: string): string {
  const now = Date.now()
  for (const [key, ticket] of tickets) if (ticket.expires < now) tickets.delete(key)
  const key = randomBytes(24).toString('hex')
  tickets.set(key, {user, campaignId, expires: now + lifetimeMs})
  return key
}

//the ticket's user and room, once; undefined when unknown or expired
export function redeemTicket(key: unknown): Omit<Ticket, 'expires'> | undefined {
  if (typeof key !== 'string') return undefined
  const ticket = tickets.get(key)
  tickets.delete(key)
  if (!ticket || ticket.expires < Date.now()) return undefined
  return {user: ticket.user, campaignId: ticket.campaignId}
}
