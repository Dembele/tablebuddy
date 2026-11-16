//Live character wrapper: pure data from DB + its evaluated snapshot. Reads go to the snapshot (read-only proxy);
//writes only through setProperty (a human decision), which persists, re-evaluates and returns the diff.
import {EvaluatedCharacter, ICharacter} from "@backend/deps/interfaces/DB/Character"
import {Formula} from "@backend/deps/types/internal/Formula"
import {typedEntries, typedFromEntries, typedKeys} from "@backend/deps/_util/translationMap"
import {ObjectId} from "@backend/deps/types/internal/ObjectId"
import {Character as CharacterCollection} from "@backend/models/Character"
import {evaluator} from "@backend/services/Evaluator"
import {previewAction} from "@backend/services/ActionPreview"
import {isObjectIdOrHexString} from "mongoose"

export type CharacterAPI = Readonly<EvaluatedCharacter> & Character
export type CharacterDiff = Partial<EvaluatedCharacter> & { _id: ObjectId }

//write one nested value by dot path, creating objects on the way
function setByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.')
  let current = target
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {}
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

//every sheet formula -> number, against the pure data; action rolls stay formulas, with a display preview against the evaluated sheet
export function evaluateCharacter(character: ICharacter): EvaluatedCharacter {
  const evaluated = evaluateSheet(character)
  return {...evaluated, actions: evaluated.actions.map((action) => ({...action, preview: previewAction(action, evaluated)}))}
}

function evaluateSheet(character: ICharacter): EvaluatedCharacter {
  const total = (formula: Formula) => evaluator.eval(formula, {character}).total
  const {spellcasting} = character

  return {
    ...character,
    proficiency: total(character.proficiency),
    attributes: typedFromEntries(typedEntries(character.attributes).map(([attribute, {value, modifier}]) =>
      [attribute, {value, modifier: total(modifier)}])),
    savingThrows: typedFromEntries(typedEntries(character.savingThrows).map(([attribute, {value, proficiency}]) =>
      [attribute, {value: total(value), proficiency}])),
    skills: typedFromEntries(typedEntries(character.skills).map(([skill, {value, proficiency, expertise}]) =>
      [skill, {value: total(value), proficiency, expertise}])),
    initiative: {value: total(character.initiative.value), proficiency: character.initiative.proficiency},
    passivePerception: total(character.passivePerception),
    armorClass: total(character.armorClass),
    maxAttunements: total(character.maxAttunements),
    hitPoints: {...character.hitPoints, max: total(character.hitPoints.max), temp: character.hitPoints.temp ?? 0},
    deathSavingThrows: {...character.deathSavingThrows, value: total(character.deathSavingThrows.value)},
    resources: character.resources.map(resource => ({...resource, max: total(resource.max)})),
    spellcasting: {
      ...spellcasting,
      slots: typedFromEntries(typedEntries(spellcasting.slots).map(([level, slot]) =>
        [level, slot && {current: slot.current, max: total(slot.max)}])),
      pactSlots: spellcasting.pactSlots && {...spellcasting.pactSlots, max: total(spellcasting.pactSlots.max)}
    }
  }
}

//top-level keys whose value changed; _id always present so clients know which character it is
export function diffCharacter(previous: EvaluatedCharacter, next: EvaluatedCharacter): CharacterDiff {
  const keys = new Set([...typedKeys(next), ...typedKeys(previous)])
  const patch: Partial<Record<keyof EvaluatedCharacter, unknown>> = {}
  for (const key of keys) if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) patch[key] = next[key]
  return {...patch, _id: next._id} as CharacterDiff
}

export class Character {
  private readonly _pureData: ICharacter
  private _evaluatedData: Readonly<EvaluatedCharacter>
  private readonly persist: boolean

  get pureData(): Readonly<ICharacter> {
    return this._pureData
  }

  get evaluatedData(): Readonly<EvaluatedCharacter> {
    return this._evaluatedData
  }

  private constructor(pureData: ICharacter, persist: boolean) {
    this._pureData = pureData
    this._evaluatedData = evaluateCharacter(pureData)
    this.persist = persist
  }

  //loads from DB; writes persist and broadcast
  public static async create(id: ObjectId): Promise<CharacterAPI> {
    const document = await CharacterCollection.findById(id)
    if (!document) throw new Error('Unable to get character')
    const instance = new Character(document.toObject({minimize: false}) as ICharacter, true) //toObject, not lean: fills defaults missing in older documents
    return instance.createProxy()
  }

  //in-memory only (tests, previews): writes re-evaluate but never touch DB or sockets
  public static fromData(pureData: ICharacter): CharacterAPI {
    const instance = new Character(structuredClone(pureData), false)
    return instance.createProxy()
  }

  public async setProperty(path: string, value: unknown): Promise<CharacterDiff> {
    const previous = this._evaluatedData
    setByPath(this._pureData as unknown as Record<string, unknown>, path, value)
    await this.commit()
    return diffCharacter(previous, this._evaluatedData)
  }

  //persist (when backed by DB), re-evaluate, broadcast the fresh snapshot
  private async commit(): Promise<void> {
    if (this.persist) {
      const stored = await CharacterCollection.findByIdAndUpdate(this._pureData._id, this._pureData).lean()
      if (!stored) throw new Error('DB Store failed.')
    }
    this._evaluatedData = evaluateCharacter(this._pureData)

    if (this.persist && process.env.NODE_ENV !== 'test') {
      const {getIo} = await import('@backend/server')
      getIo().to(String(this._pureData.campaign)) //room key = campaign id (events/main.ts)
        .emit('update-character', {character: this._evaluatedData})
    }
  }

  //snapshot fields read through, methods bound, every write refused
  private createProxy(): CharacterAPI {
    return new Proxy(this, {
      get: (target, property) => {
        if (typeof property === 'string' && property in target._evaluatedData) {
          const value = target._evaluatedData[property as keyof EvaluatedCharacter]
          return value !== null && typeof value === 'object' && !isObjectIdOrHexString(value) ? readOnly(value) : value
        }
        const member = Reflect.get(target, property)
        return typeof member === 'function' ? member.bind(target) : member
      },
      set: () => {
        throw new Error('Cannot modify properties directly. Use setProperty(path, value) for updates.')
      }
    }) as unknown as CharacterAPI
  }
}

//deep read-only view over a snapshot branch
function readOnly<T extends object>(value: T): T {
  return new Proxy(value, {
    get: (target, property) => {
      const member = Reflect.get(target, property)
      return member !== null && typeof member === 'object' ? readOnly(member) : member
    },
    set: () => {
      throw new Error('Cannot modify nested properties directly. Use setProperty(path, value) for updates.')
    }
  })
}
