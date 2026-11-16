'use client'
//Editor shell: sections over one draft, saved as a whole document; the backend re-evaluates and broadcasts.
//Order = how often a DM needs it: what changes in play first and open, set-once parts folded below (each shows a digest).
import {useState, useTransition} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import type {ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {deleteCharacter, updateCharacter} from "@frontend/actions/characters"
import {useDraft} from "@frontend/components/Character/editor/useDraft"
import type {EditorOptions} from "@frontend/components/Character/editor/options"
import Spinner from "@frontend/components/UI/Spinner"
import {
  AbilitiesSection, ClassesSection, ConditionsSection, FeaturesSection, FormulasSection, IdentitySection,
  InventorySection, MagicSection, ProficienciesSection, VitalsSection
} from "@frontend/components/Character/editor/sections"

//fields the backend owns
const editable = ({_id, owner, campaign, templateSource, ...rest}: ICharacter & { createdAt?: unknown; updatedAt?: unknown; __v?: unknown }) => {
  const {createdAt, updatedAt, __v, ...fields} = rest
  return fields
}

export default function CharacterEditor({id, initial, options}: { id: string; initial: ICharacter; options: EditorOptions }) {
  const {draft, set, dirty, markSaved} = useDraft(initial)
  const [status, setStatus] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const save = () => startTransition(async () => {
    const {isSuccess, message} = await updateCharacter(id, editable(draft))
    setStatus(isSuccess ? {kind: 'success', text: 'Сохранено'} : {kind: 'danger', text: message})
    if (isSuccess) markSaved()
  })

  const remove = () => startTransition(async () => {
    const {isSuccess, message} = await deleteCharacter(id)
    if (isSuccess) router.push('/characters')
    else setStatus({kind: 'danger', text: message})
  })

  const props = {draft, set, options}
  return (
    <>
      <div className="tb-sticky-bar">
        <h1 className="h4 mb-0 flex-grow-1 text-truncate">{draft.name}</h1>
        {status && !dirty && <span className={`text-${status.kind} small`}>{status.text}</span>}
        {dirty && <span className="text-warning small">есть несохранённые правки</span>}
        <Link href={`/characters/${id}`} className="btn btn-sm btn-outline-secondary">К листу</Link>
        <button type="button" className="btn btn-sm btn-primary" disabled={pending || !dirty} onClick={save}>{pending ? <Spinner/> : 'Сохранить'}</button>
      </div>
      {status?.kind === 'danger' && dirty && <div className="alert alert-danger">{status.text}</div>}

      <IdentitySection {...props}/>
      <VitalsSection {...props}/>
      <InventorySection {...props}/>
      <MagicSection {...props}/>
      <ConditionsSection {...props}/>
      <ClassesSection {...props}/>
      <AbilitiesSection {...props}/>
      <ProficienciesSection {...props}/>
      <FeaturesSection {...props}/>
      <FormulasSection {...props}/>

      <div className="d-flex gap-2 mt-3">
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={remove}>Удалить «{draft.name}» навсегда</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setConfirmDelete(false)}>Нет</button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>Удалить персонажа</button>
        )}
      </div>
    </>
  )
}
