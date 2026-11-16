'use server'
//Monster token pack (DM): which bestiary monsters have a hand-made token, save one, remove it.
import {revalidatePath} from "next/cache"
import api from "@frontend/_util/api"

export interface MonsterToken { avatar: string; image?: string }

export async function listMonsterTokens() {
  return await api<string[]>('get', '/monster-token')
}

export async function getMonsterToken(id: string) {
  return await api<MonsterToken | null>('get', `/monster-token/${encodeURIComponent(id)}`)
}

export async function saveMonsterToken(id: string, avatar: string, image?: string) {
  const result = await api<MonsterToken>('put', `/monster-token/${encodeURIComponent(id)}`, {avatar, ...(image ? {image} : {})})
  revalidatePath(`/compendium/monsters/${id}`)
  revalidatePath('/compendium/monsters')
  return {isSuccess: result.isSuccess, message: result.message}
}

export async function deleteMonsterToken(id: string) {
  const result = await api<void>('delete', `/monster-token/${encodeURIComponent(id)}`)
  revalidatePath(`/compendium/monsters/${id}`)
  revalidatePath('/compendium/monsters')
  return {isSuccess: result.isSuccess, message: result.message}
}
