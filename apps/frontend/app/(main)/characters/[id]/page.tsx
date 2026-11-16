//Character sheet: the evaluated snapshot from the backend; player buttons and requests (campaign room), DM access block.
//A stat-block character (from the bestiary) shows its live numbers and actions plus the printed block instead of the builder parts.
import {getEvaluatedCharacter} from "@frontend/actions/characters"
import SheetHeader from "@frontend/components/Character/sheet/SheetHeader"
import CombatStats from "@frontend/components/Character/sheet/CombatStats"
import Attributes from "@frontend/components/Character/sheet/Attributes"
import Skills from "@frontend/components/Character/sheet/Skills"
import Proficiencies from "@frontend/components/Character/sheet/Proficiencies"
import Features from "@frontend/components/Character/sheet/Features"
import Spellcasting from "@frontend/components/Character/sheet/Spellcasting"
import Inventory from "@frontend/components/Character/sheet/Inventory"
import ActionsAndResources from "@frontend/components/Character/sheet/ActionsAndResources"
import Block from "@frontend/components/Character/sheet/Block"
import {AccessForm, ProfileForm} from "@frontend/components/Character/sheet/SheetButtons"
import {requireUser} from "@frontend/_util/session"
import {listUsers} from "@frontend/actions/campaigns"
import RoomProvider from "@frontend/components/Room/RoomProvider"
import RoomDock from "@frontend/components/Room/RoomDock"
import TokenMaker from "@frontend/components/Character/TokenMaker"
import StatBlock from "@frontend/components/Compendium/StatBlock"
import {monsterById} from "@frontend/_util/compendium"
import QuickControls from "@frontend/components/Room/QuickControls"

export default async function CharacterPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const [user, {data: character, message}] = await Promise.all([requireUser(), getEvaluatedCharacter(id)])
  if (!character) return <div className="container"><div className="alert alert-danger">{message}</div></div>
  const isDM = user.role === 'ГМ'
  const monster = character.monster ? monsterById(character.monster) : undefined
  const users = isDM ? ((await listUsers()).data ?? []).map((entry) => ({id: String(entry._id), username: entry.username})) : []
  const username = (userId: string) => users.find((entry) => entry.id === userId)?.username ?? '—'
  const accessDigest = [`владелец: ${username(String(character.owner))}`, character.usableBy.length ? `доступ ещё у ${character.usableBy.length}` : null,
    character.isTemplate ? 'шаблон' : character.templateSource ? 'копия шаблона' : character.isNPC ? 'НИП' : null].filter(Boolean).join(' · ')

  return (
    <RoomProvider campaignId={String(character.campaign)} user={{id: String(user._id), username: user.username, role: user.role}}>
      <div className="container">
        <SheetHeader character={character} isDM={isDM} isOwner={String(character.owner) === String(user._id)}/>
        <div className="row g-3">
          <div className="col-12"><Attributes character={character}/></div>
          <div className="col-lg-8 d-flex flex-column gap-3">
            <CombatStats character={character}/>
            {isDM && (
              <Block fold title="Быстрые действия (ГМ)" digest="урон, лечение, временные хиты, состояния">
                <QuickControls targets={[{_id: character._id, name: character.name, hitPoints: character.hitPoints, conditions: character.conditions, deathSavingThrows: character.deathSavingThrows}]}/>
              </Block>
            )}
            {!monster && <Proficiencies character={character}/>}
          </div>
          <div className="col-lg-4"><Skills character={character}/></div>
          {monster ? (
            <>
              <div className="col-lg-6"><ActionsAndResources character={character}/></div>
              <div className="col-lg-6"><Block title="Блок характеристик"><StatBlock monster={monster} withNumbers={false} withLore={false}/></Block></div>
            </>
          ) : (
            <>
              <div className="col-lg-6"><Features character={character}/></div>
              <div className="col-lg-6"><Spellcasting character={character}/></div>
              <div className="col-lg-6"><Inventory character={character}/></div>
              <div className="col-lg-6"><ActionsAndResources character={character}/></div>
            </>
          )}
          <div className="col-12">
            <Block fold title="Имя и заметки" digest={character.notes ? character.notes.split('\n')[0].slice(0, 80) : 'заметок нет'}>
              <ProfileForm characterId={id} name={character.name} notes={character.notes}/>
            </Block>
          </div>
          <div className="col-12">
            <Block fold title="Токен" digest={character.avatar ? 'есть — открыть, чтобы перекадрировать' : 'нет — буква вместо картинки'}>
              <TokenMaker characterId={id} storedImage={character.image} currentAvatar={character.avatar}/>
            </Block>
          </div>
          {isDM && (
            <div className="col-12">
              <Block fold title="Доступ (ГМ)" digest={accessDigest}>
                <AccessForm characterId={id} users={users} owner={String(character.owner)} usableBy={character.usableBy.map(String)} isNPC={character.isNPC}
                            isTemplate={character.isTemplate} isCopy={!!character.templateSource}/>
              </Block>
            </div>
          )}
        </div>
      </div>
      <RoomDock characterId={id}/>
    </RoomProvider>
  )
}
