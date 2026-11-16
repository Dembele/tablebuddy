'use server'
//Character server actions over the backend REST: summaries, evaluated snapshot, raw data, create / update / delete.
import api from "@frontend/_util/api"
import {revalidatePath} from "next/cache"
import {EvaluatedCharacter, ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {ICampaign} from "@frontend/deps/interfaces/DB/Campaign"

export type CharacterSummary = Pick<ICharacter, '_id' | 'name' | 'avatar' | 'race' | 'background' | 'classes' | 'campaign' | 'owner' | 'isNPC' | 'isTemplate' | 'templateSource' | 'monster'>
export type CampaignSummary = Pick<ICampaign, '_id' | 'name' | 'status'>

export async function listCharacters(campaign?: string) {
  return await api<CharacterSummary[]>('get', campaign ? `/character?campaign=${encodeURIComponent(campaign)}` : '/character')
}

export async function listCampaigns() {
  return await api<CampaignSummary[]>('get', '/campaign')
}

export async function getEvaluatedCharacter(id: string) {
  return await api<EvaluatedCharacter>('get', `/character/evaluated/${id}`)
}

export async function getRawCharacter(id: string) {
  return await api<ICharacter>('get', `/character/${id}`)
}

export async function createCharacter(campaign: string, name?: string) {
  const result = await api<{ _id: string }>('post', '/character', {campaign, name})
  revalidatePath('/characters')
  return result
}

//DM: a stat-block template from the Monster Manual in this campaign
export async function createFromMonster(campaign: string, monster: string) {
  const result = await api<{ _id: string }>('post', '/character/from-monster', {campaign, monster})
  revalidatePath('/characters')
  revalidatePath(`/campaigns/${campaign}`)
  return result
}

//4d6 drop lowest ×6, rolled by the backend once per character
export async function rollScores(id: string) {
  return await api<Array<{ total: number; dice: number[] }>>('post', `/character/${id}/roll-scores`)
}

export async function updateCharacter(id: string, character: Partial<ICharacter>) {
  const result = await api<void>('put', `/character/${id}`, character)
  revalidatePath(`/characters/${id}`)
  return result
}

//player buttons: rule-bound choices and the profile; the backend checks the rules
export async function updateProfile(id: string, profile: Partial<Pick<ICharacter, 'name' | 'notes' | 'avatar' | 'image'>>) {
  const result = await api<void>('patch', `/character/${id}/profile`, profile)
  revalidatePath(`/characters/${id}`)
  return result
}

export async function chooseOnSheet(id: string, choice: 'equip' | 'unequip' | 'attune' | 'prepare', body: Record<string, unknown>) {
  const result = await api<unknown>('post', `/character/${id}/${choice}`, body)
  revalidatePath(`/characters/${id}`)
  return {isSuccess: result.isSuccess, message: result.message}
}

//DM switch: allow one level-up
export async function setLevelUpAllowed(id: string, allowed: boolean) {
  const result = await api<unknown>('patch', `/character/${id}/level-up`, {allowed})
  revalidatePath(`/characters/${id}`)
  return {isSuccess: result.isSuccess, message: result.message}
}

export async function deleteCharacter(id: string) {
  const result = await api<void>('delete', `/character/${id}`)
  revalidatePath('/characters')
  return result
}

//DM: owner, shared with, NPC flag
export async function updateAccess(id: string, access: { owner?: string; usableBy?: string[]; isNPC?: boolean; isTemplate?: boolean }) {
  const result = await api<void>('patch', `/character/${id}/access`, access)
  revalidatePath(`/characters/${id}`)
  revalidatePath('/characters')
  return {isSuccess: result.isSuccess, message: result.message}
}
