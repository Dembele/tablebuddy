import {Chat} from "@backend/models/ChatMessage"
import {FChatMessage, SystemMessage} from "@backend/deps/interfaces/DB/Chat"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {EvaluatedCharacter, FCharacter, ICharacter} from "@backend/deps/interfaces/DB/Character"
import {CharacterAPI} from "@backend/services/Character"

export async function handleMessage(message: Omit<FChatMessage, "_id" | 'timestamp'> | SystemMessage): Promise<FChatMessage> {
  const msg = await Chat.create(message)

  const populatedMsg: FChatMessage | null = await Chat.findById(msg._id)
    .populate<{ sender: Pick<UserSafe, '_id' | 'username' | 'role'> }>('sender', 'username role _id')
    .populate<{
      introduceAsCharacter: Pick<ICharacter, 'name' | 'avatar' | '_id'>
    }>('introduceAsCharacter', '_id name avatar')
    .lean()

  if (!populatedMsg) {
    throw new Error("Could not find a message we just pasted, is it there?")
  }

  return populatedMsg
}

export function getIntroduce(char: ICharacter | FCharacter | EvaluatedCharacter | CharacterAPI): Pick<ICharacter, 'name' | 'avatar' | '_id'> {
  return {_id: char._id, name: char.name, avatar: char.avatar}
}