'use client'
//Sheet buttons (Doctrine: players press, the backend checks the rules): equip / attune, prepare, profile, delete; DM level-up switch and access.
import {ReactNode, useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {chooseOnSheet, deleteCharacter, setLevelUpAllowed, updateAccess, updateProfile} from "@frontend/actions/characters"
import Spinner from "@frontend/components/UI/Spinner"

//shared: run an action, refresh the sheet, show the refusal next to the button
function useSheetAction() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const run = (action: () => Promise<{ isSuccess: boolean; message: string }>) => startTransition(async () => {
    setError(null)
    const {isSuccess, message} = await action()
    if (isSuccess) router.refresh()
    else setError(message)
  })
  const errorLine: ReactNode = error ? <span className="small text-danger ms-1">{error}</span> : null
  return {pending, run, errorLine}
}

interface EntryButtonsProps {
  characterId: string
  entryId: string
  equipped: boolean
  attuned: boolean
  canEquip: boolean
  needsAttunement: boolean
}

export function EntryButtons({characterId, entryId, equipped, attuned, canEquip, needsAttunement}: EntryButtonsProps) {
  const {pending, run, errorLine} = useSheetAction()
  return (
    <span className="ms-2">
      {canEquip && (
        <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1 me-1" disabled={pending}
                onClick={() => run(() => chooseOnSheet(characterId, equipped ? 'unequip' : 'equip', {entryId}))}>
          {equipped ? 'Снять' : 'Надеть'}
        </button>
      )}
      {needsAttunement && (
        <button type="button" className="btn btn-sm btn-outline-info py-0 px-1" disabled={pending}
                onClick={() => run(() => chooseOnSheet(characterId, 'attune', {entryId, attuned: !attuned}))}>
          {attuned ? 'Разорвать настройку' : 'Настроиться'}
        </button>
      )}
      {pending && <Spinner/>}
      {errorLine}
    </span>
  )
}

export function PrepareButton({characterId, spell, source, prepared}: { characterId: string; spell: string; source: string; prepared: boolean }) {
  const {pending, run, errorLine} = useSheetAction()
  return (
    <span className="ms-1">
      <button type="button" className={`btn btn-sm py-0 px-1 ${prepared ? 'btn-primary' : 'btn-outline-secondary'}`} disabled={pending}
              onClick={() => run(() => chooseOnSheet(characterId, 'prepare', {spell, source, prepared: !prepared}))}>
        {prepared ? 'подготовлено' : 'подготовить'}
      </button>
      {errorLine}
    </span>
  )
}

export function LevelUpSwitch({characterId, allowed}: { characterId: string; allowed: boolean }) {
  const {pending, run, errorLine} = useSheetAction()
  return (
    <>
      <button type="button" className={`btn btn-sm ${allowed ? 'btn-outline-warning' : 'btn-outline-secondary'}`} disabled={pending} aria-pressed={allowed}
              title={allowed ? 'Игрок может повысить уровень — нажмите, чтобы запретить' : 'Разрешить игроку одно повышение уровня'}
              onClick={() => run(() => setLevelUpAllowed(characterId, !allowed))}>
        {allowed ? 'Повышение разрешено' : 'Разрешить повышение'}
      </button>
      {errorLine}
    </>
  )
}

//owner or DM: two-step confirm, then back to the list
export function DeleteCharacterButton({characterId, name}: { characterId: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const remove = () => startTransition(async () => {
    const {isSuccess, message} = await deleteCharacter(characterId)
    if (isSuccess) router.push('/characters')
    else setError(message)
  })

  if (!confirming) return <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setConfirming(true)}>Удалить</button>
  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-1 small">
      <button type="button" className="btn btn-sm btn-danger" disabled={pending} title={`Удалить «${name}» навсегда`} onClick={remove}>{pending ? <Spinner/> : 'Удалить навсегда'}</button>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pending} onClick={() => setConfirming(false)}>Нет</button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  )
}

export interface UserOption {
  id: string
  username: string
}

//DM: who owns the character, who else may play it, NPC / template flags (a template drops numbered copies on the map)
export function AccessForm({characterId, users, owner, usableBy, isNPC, isTemplate, isCopy}: {
  characterId: string; users: UserOption[]; owner: string; usableBy: string[]; isNPC: boolean; isTemplate: boolean; isCopy: boolean
}) {
  const [draftOwner, setDraftOwner] = useState(owner)
  const [shared, setShared] = useState(usableBy)
  const [npc, setNpc] = useState(isNPC)
  const [template, setTemplate] = useState(isTemplate)
  const [saved, setSaved] = useState(false)
  const {pending, run, errorLine} = useSheetAction()

  const toggleShared = (userId: string) => { setShared((current) => current.includes(userId) ? current.filter((entry) => entry !== userId) : [...current, userId]); setSaved(false) }
  const save = () => run(async () => {
    const result = await updateAccess(characterId, {owner: draftOwner, usableBy: shared.filter((userId) => userId !== draftOwner), isNPC: npc || template, isTemplate: template})
    setSaved(result.isSuccess)
    return result
  })

  return (
    <div className="row g-2 small">
      <div className="col-md-4">
        <label className="form-label w-100">Владелец
          <select className="form-select form-select-sm" value={draftOwner} onChange={(event) => { setDraftOwner(event.target.value); setSaved(false) }}>
            {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </select>
        </label>
        <div className="form-check">
          <input id="npc-flag" type="checkbox" className="form-check-input" checked={npc} onChange={(event) => { setNpc(event.target.checked); setSaved(false) }}/>
          <label htmlFor="npc-flag" className="form-check-label">НИП (персонаж мастера)</label>
        </div>
        {!isCopy && (
          <div className="form-check" title="Каждая постановка на карту создаёт новую копию со своим листом: «Гоблин 1», «Гоблин 2»…">
            <input id="template-flag" type="checkbox" className="form-check-input" checked={template} onChange={(event) => { setTemplate(event.target.checked); setSaved(false) }}/>
            <label htmlFor="template-flag" className="form-check-label">Шаблон (копии на карте)</label>
          </div>
        )}
      </div>
      <div className="col-md-8">
        <div className="mb-1">Также доступен</div>
        <div className="d-flex flex-wrap gap-1">
          {users.filter((user) => user.id !== draftOwner).map((user) => (
            <button key={user.id} type="button" className={`btn btn-sm py-0 ${shared.includes(user.id) ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => toggleShared(user.id)}>
              {user.username}
            </button>
          ))}
        </div>
      </div>
      <div className="col-12 d-flex align-items-center gap-2">
        <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={save}>{pending ? <Spinner/> : 'Сохранить доступ'}</button>
        {saved && <span className="text-success">Сохранено</span>}
        {errorLine}
      </div>
    </div>
  )
}

//name and notes; the picture is the token maker's
export function ProfileForm({characterId, name, notes}: { characterId: string; name: string; notes?: string }) {
  const [draftName, setDraftName] = useState(name === 'not_init' ? '' : name)
  const [draftNotes, setDraftNotes] = useState(notes ?? '')
  const [saved, setSaved] = useState(false)
  const {pending, run, errorLine} = useSheetAction()

  const save = () => run(async () => {
    const result = await updateProfile(characterId, {name: draftName.trim(), notes: draftNotes})
    setSaved(result.isSuccess)
    return result
  })

  return (
    <div className="row g-2">
      <div className="col-md-4">
        <label className="form-label small w-100">Имя
          <input className="form-control form-control-sm" value={draftName} onChange={(event) => { setDraftName(event.target.value); setSaved(false) }}/>
        </label>
      </div>
      <div className="col-md-8">
        <label className="form-label small w-100">Заметки
          <textarea className="form-control form-control-sm" rows={4} value={draftNotes} onChange={(event) => { setDraftNotes(event.target.value); setSaved(false) }}/>
        </label>
      </div>
      <div className="col-12 d-flex align-items-center gap-2">
        <button type="button" className="btn btn-sm btn-primary" disabled={pending || !draftName.trim()} onClick={save}>{pending ? <Spinner/> : 'Сохранить профиль'}</button>
        {saved && <span className="small text-success">Сохранено</span>}
        {errorLine}
      </div>
    </div>
  )
}
