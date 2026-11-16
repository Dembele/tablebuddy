//NPC templates (a goblin): every drop makes a numbered copy with its own sheet and HP; non-template NPCs stay single (a BBEG).
//A copy is deleted with its token by a DM press — sheets of copies are disposable, the template is the one kept.
import {Types} from "mongoose"
import {Character} from "@backend/models/Character"
import {Map as MapDoc} from "@backend/models/Map"
import {characterManager} from "@backend/services/CharacterManager"
import {ObjectId} from "@backend/deps/types/internal/ObjectId"

//new copy of the stored template: next free number after the existing copies' names
export async function spawnCopy(templateId: ObjectId): Promise<ObjectId> {
  const template = await Character.findById(templateId).lean()
  if (!template) throw new Error('Шаблон не найден')
  const copies = await Character.find({templateSource: template._id}).select('name').lean()
  const taken = copies.map(copy => Number(copy.name.match(/(\d+)$/)?.[1] ?? 0))
  const {_id, createdAt, updatedAt, __v, ...copyFields} = template as typeof template & { createdAt?: Date; updatedAt?: Date; __v?: number }
  const copy = await Character.create({
    ...copyFields,
    name: `${template.name} ${Math.max(0, ...taken) + 1}`,
    isTemplate: false,
    isNPC: true,
    usableBy: [],
    templateSource: template._id
  })
  return copy._id
}

//ids of a template's copies in a campaign
export async function copiesOf(templateId: ObjectId, campaignId: ObjectId): Promise<string[]> {
  const copies = await Character.find({templateSource: templateId, campaign: campaignId}).select('_id').lean()
  return copies.map(copy => String(copy._id))
}

//delete copies (never a template or a plain character) and pull their tokens from the campaign's maps other than the loaded one
export async function deleteCopies(characterIds: string[], campaignId: ObjectId, loadedMapId?: ObjectId): Promise<string[]> {
  const deletable = await Character.find({_id: {$in: characterIds}, templateSource: {$exists: true, $ne: null}}).select('_id').lean()
  const ids = deletable.map(copy => String(copy._id))
  if (!ids.length) return []
  const objectIds = ids.map(id => new Types.ObjectId(id))
  await MapDoc.updateMany({campaign: campaignId, ...(loadedMapId ? {_id: {$ne: loadedMapId}} : {})}, {$pull: {tokens: {character: {$in: objectIds}}}})
  await Character.deleteMany({_id: {$in: objectIds}})
  ids.forEach(id => characterManager.deleteCharacter(id))
  return ids
}
