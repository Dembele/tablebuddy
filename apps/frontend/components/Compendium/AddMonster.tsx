'use client'
//DM: put a Monster Manual stat block into a campaign as a template character, then open its sheet; remove the pack token.
import {useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {createFromMonster} from "@frontend/actions/characters"
import {deleteMonsterToken} from "@frontend/actions/monsters"
import Spinner from "@frontend/components/UI/Spinner"

export default function AddMonster({monster, campaigns, preselected}: { monster: string; campaigns: Array<{ id: string; name: string }>; preselected?: string }) {
  const [campaign, setCampaign] = useState(preselected ?? campaigns[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const add = () => startTransition(async () => {
    setError(null)
    const {data, message} = await createFromMonster(campaign, monster)
    if (data) router.push(`/characters/${data._id}`)
    else setError(message)
  })

  if (!campaigns.length) return <div className="small text-muted">Нет кампаний, куда добавить.</div>
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 small">
      <select className="form-select form-select-sm w-auto" value={campaign} onChange={(event) => setCampaign(event.target.value)} aria-label="Кампания">
        {campaigns.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
      <button type="button" className="btn btn-sm btn-success" disabled={pending || !campaign} onClick={add} title="Шаблон: каждая постановка на карту — новая копия">
        {pending ? <Spinner/> : 'Добавить в кампанию'}
      </button>
      {error && <span className="text-danger">{error}</span>}
    </div>
  )
}

//DM: drop the monster's pack token (templates already made keep their copy of the path until re-cropped)
export function RemoveMonsterToken({monster}: { monster: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const remove = () => startTransition(async () => {
    const {isSuccess, message} = await deleteMonsterToken(monster)
    if (isSuccess) router.refresh()
    else setError(message)
  })
  return (
    <span className="small">
      <button type="button" className="btn btn-sm btn-outline-danger" disabled={pending} onClick={remove}>{pending ? <Spinner/> : 'Удалить токен'}</button>
      {error && <span className="text-danger ms-1">{error}</span>}
    </span>
  )
}
