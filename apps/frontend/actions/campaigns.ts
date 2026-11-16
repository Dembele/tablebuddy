'use server'
//Campaign server actions over the backend REST: list / read / create / update / delete, plus the user list for player picks.
import api from "@frontend/_util/api"
import {revalidatePath} from "next/cache"
import type {ICampaign} from "@frontend/deps/interfaces/DB/Campaign"
import type {UserSafe} from "@frontend/deps/interfaces/DB/User"

export type CampaignStatus = ICampaign['status']
export type CampaignListEntry = Pick<ICampaign, '_id' | 'name' | 'description' | 'image' | 'status' | 'players'>

export interface CampaignInput {
  name: string
  description: string
  status: CampaignStatus
  players: string[]
  image?: string | null                                                                                                 //data URL = new cover, null = remove, undefined = keep
}

export async function listCampaignEntries() {
  return await api<CampaignListEntry[]>('get', '/campaign')
}

export async function getCampaign(id: string) {
  return await api<ICampaign>('get', `/campaign/${id}`)
}

export async function listUsers() {
  return await api<Array<Pick<UserSafe, '_id' | 'username' | 'role'>>>('get', '/user')
}

export async function createCampaign(input: CampaignInput) {
  const result = await api<{ _id: string }>('post', '/campaign', input)
  revalidatePath('/campaigns')
  return result
}

export async function updateCampaign(id: string, input: CampaignInput) {
  const result = await api<void>('put', `/campaign/${id}`, input)
  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  return result
}

export async function deleteCampaign(id: string) {
  const result = await api<void>('delete', `/campaign/${id}`)
  revalidatePath('/campaigns')
  return result
}

//DM: role switch on the users page
export async function setUserRole(id: string, role: UserSafe['role']) {
  const result = await api<void>('patch', `/user/${id}/role`, {role})
  revalidatePath('/users')
  return {isSuccess: result.isSuccess, message: result.message}
}

//DM: set a new password for a user (their sessions end)
export async function resetUserPassword(id: string, password: string) {
  const result = await api<void>('patch', `/user/${id}/password`, {password})
  return {isSuccess: result.isSuccess, message: result.message}
}
