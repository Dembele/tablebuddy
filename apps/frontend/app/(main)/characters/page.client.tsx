'use client'
//Create form: pick a campaign, optional name; opens the new character. Every failure is shown, never swallowed.
import {useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import Link from "next/link"
import {createCharacter} from "@frontend/actions/characters"
import Spinner from "@frontend/components/UI/Spinner"

export default function CreateCharacterForm({campaigns, campaignsError}: { campaigns: Array<{ id: string; name: string }>; campaignsError?: string }) {
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => startTransition(async () => {
    setError(null)
    try {
      const {data, message, statusCode} = await createCharacter(campaign, name.trim() || undefined)
      if (data?._id) router.push(`/characters/${data._id}`)
      else setError(`${statusCode}: ${message}`)
    } catch (thrown) {
      console.error('createCharacter failed', thrown)
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    }
  })

  if (campaignsError) return <div className="alert alert-danger mb-0">Не удалось загрузить кампании: {campaignsError}</div>
  if (!campaigns.length) return <p className="text-muted mb-0">Нет кампаний: персонаж всегда принадлежит кампании. ГМ создаёт её в разделе <Link href="/campaigns">«Кампании»</Link> и добавляет игроков.</p>

  return (
    <div className="row g-2 align-items-end">
      {error && <div className="col-12"><div className="alert alert-danger py-1 mb-0">{error}</div></div>}
      <div className="col-md-5">
        <label className="form-label" htmlFor="campaign">Кампания</label>
        <select id="campaign" className="form-select" value={campaign} onChange={(event) => setCampaign(event.target.value)}>
          {campaigns.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>
      <div className="col-md-5">
        <label className="form-label" htmlFor="name">Имя</label>
        <input id="name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} placeholder="можно позже"/>
      </div>
      <div className="col-md-2">
        <button type="button" className="btn btn-primary w-100" disabled={pending} onClick={submit}>{pending ? <Spinner/> : 'Создать'}</button>
      </div>
    </div>
  )
}
