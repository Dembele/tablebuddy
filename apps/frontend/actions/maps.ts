'use server'
//Map server actions over the backend REST: a campaign's maps, one map, DM create / update / delete, current map;
//the shared map library (campaign-free maps): list, upload, snapshot a campaign map in, import a copy into a campaign.
import api from "@frontend/_util/api"
import {revalidatePath} from "next/cache"
import type {IMap} from "@frontend/deps/interfaces/DB/Map"

export type MapSummary = Pick<IMap, '_id' | 'name' | 'description' | 'backgroundImagePath' | 'thumbnailPath' | 'gridType' | 'campaign'>
export type LibraryMapSummary = MapSummary & Pick<IMap, 'placements'>

//pages that list a map: its campaign's, or the library
const listPath = (campaign?: string) => campaign ? `/campaigns/${campaign}` : '/maps'

export interface MapInput {
  name: string
  description: string
  gridType: IMap['gridType']
  gridConfig: IMap['gridConfig']
  fogEnabled: boolean                                                                                                   //fog of war on the game room canvas
  image?: string                                                                                                        //data URL = new image, absent = keep
}

export async function listMaps(campaign: string) {
  return await api<MapSummary[]>('get', `/map?campaign=${encodeURIComponent(campaign)}`)
}

export async function getMap(id: string) {
  return await api<IMap>('get', `/map/${id}`)
}

export async function createMap(campaign: string, input: MapInput) {
  const result = await api<{ _id: string }>('post', '/map', {...input, campaign})
  revalidatePath(`/campaigns/${campaign}`)
  return result
}

export async function updateMap(id: string, campaign: string | undefined, input: MapInput) {
  const result = await api<void>('put', `/map/${id}`, input)
  revalidatePath(listPath(campaign))
  return {isSuccess: result.isSuccess, message: result.message}
}

export async function deleteMap(id: string, campaign?: string) {
  const result = await api<void>('delete', `/map/${id}`)
  revalidatePath(listPath(campaign))
  return {isSuccess: result.isSuccess, message: result.message}
}

export async function setCurrentMap(campaign: string, mapId: string | null) {
  const result = await api<void>('patch', `/campaign/${campaign}/current-map`, {mapId})
  revalidatePath(`/campaigns/${campaign}`)
  return {isSuccess: result.isSuccess, message: result.message}
}

export async function listLibrary() {
  return await api<LibraryMapSummary[]>('get', '/map/library')
}

export async function createLibraryMap(input: MapInput) {
  const result = await api<{ _id: string }>('post', '/map/library', input)
  revalidatePath('/maps')
  return result
}

//a campaign map's snapshot into the library (its monsters kept as placements)
export async function saveToLibrary(mapId: string) {
  const result = await api<{ _id: string }>('post', `/map/${mapId}/to-library`)
  revalidatePath('/maps')
  return {isSuccess: result.isSuccess, message: result.message}
}

//a library map copied into a campaign, monsters placed
export async function importFromLibrary(libraryId: string, campaign: string) {
  const result = await api<{ _id: string }>('post', `/map/${libraryId}/import`, {campaign})
  revalidatePath(`/campaigns/${campaign}`)
  return result
}
