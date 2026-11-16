import {Character, CharacterAPI} from '@backend/services/Character'
import {ObjectId} from "@backend/deps/types/internal/ObjectId"

class CharacterManager {
  private characters = new Map<string, CharacterAPI>()
  private characterPromises = new Map<string, Promise<CharacterAPI>>()

  private async initCharacter(id: ObjectId): Promise<CharacterAPI> {
    try {
      // Check if character is already being initialized
      if (this.characterPromises.has(id.toString())) {
        return this.characterPromises.get(id.toString())!
      }

      // Create and store the promise
      const characterPromise = Character.create(id.toString())
      this.characterPromises.set(id.toString(), characterPromise)

      const character = await characterPromise
      this.characters.set(id.toString(), character)
      this.characterPromises.delete(id.toString())

      return character
    } catch (error) {
      this.characterPromises.delete(id.toString())
      console.error('Failed to initialize character:', error)
      throw error
    }
  }

  public getCharacter(id: ObjectId): CharacterAPI | undefined {
    return this.characters.get(id.toString())
  }

  public async getOrCreateCharacter(id: ObjectId): Promise<CharacterAPI> {
    const existing = this.getCharacter(id.toString())
    if (existing) {
      return existing
    }
    return this.initCharacter(id.toString())
  }

  public deleteCharacter(id: ObjectId): boolean {
    this.characterPromises.delete(id.toString())
    return this.characters.delete(id.toString())
  }

  public getAllCharacters(): ReadonlyMap<ObjectId, CharacterAPI> {
    return this.characters
  }

  public async revalidateCharacter(id: ObjectId): Promise<CharacterAPI> {
    console.log('Revalidating character:', id)
    this.characters.delete(id.toString())
    return await this.initCharacter(id.toString())
  }

  public clear(): this {
    this.characters.clear()
    this.characterPromises.clear()
    return this
  }
}

export const characterManager = new CharacterManager()