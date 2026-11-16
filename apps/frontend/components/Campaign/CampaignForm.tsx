'use client'
//Campaign create / edit form (DM): name, description, status, optional cover (sent as a data URL), players.
import {ChangeEvent, useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {CampaignInput, CampaignStatus, createCampaign, deleteCampaign, updateCampaign} from "@frontend/actions/campaigns"
import Spinner from "@frontend/components/UI/Spinner"

const statuses: CampaignStatus[] = ['В процессе', 'На паузе', 'Завершена']
const maxCoverBytes = 8 * 1024 * 1024 //server actions accept 10mb, base64 adds a third

interface CampaignFormProps {
  id?: string                                                                                                           //absent = create
  initial?: Omit<CampaignInput, 'image'> & { image?: string | null }
  users: Array<{ id: string; username: string; role: string }>
}

export default function CampaignForm({id, initial, users}: CampaignFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<CampaignStatus>(initial?.status ?? 'В процессе')
  const [players, setPlayers] = useState<string[]>(initial?.players ?? [])
  const [cover, setCover] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const preview = cover === undefined ? initial?.image : cover

  const pickCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > maxCoverBytes) return setError('Обложка больше 8 МБ')
    const reader = new FileReader()
    reader.onload = () => setCover(String(reader.result))
    reader.readAsDataURL(file)
  }

  const togglePlayer = (userId: string) => setPlayers(players.includes(userId) ? players.filter((player) => player !== userId) : [...players, userId])

  const submit = () => startTransition(async () => {
    setError(null)
    setNotice(null)
    const input: CampaignInput = {name: name.trim(), description, status, players, ...(cover !== undefined ? {image: cover} : {})}
    try {
      if (id) {
        const {isSuccess, message} = await updateCampaign(id, input)
        if (!isSuccess) return setError(message)
        setNotice('Сохранено')
        router.refresh()
      } else {
        const {data, message} = await createCampaign(input)
        if (!data?._id) return setError(message)
        router.push(`/campaigns/${data._id}`)
      }
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    }
  })

  const remove = () => {
    if (!id || !window.confirm('Удалить кампанию вместе с картами? Это нельзя отменить.')) return
    startTransition(async () => {
      const {isSuccess, message} = await deleteCampaign(id)
      if (isSuccess) router.push('/campaigns')
      else setError(message)
    })
  }

  console.log(pending)

  return (
    <div className="card bg-dark">
      <div className="card-body">
        {error && <div className="alert alert-danger py-1">{error}</div>}
        {notice && <div className="alert alert-success py-1">{notice}</div>}
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label w-100">Название
              <input className="form-control" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required/>
            </label>
            <label className="form-label w-100">Описание
              <textarea className="form-control" rows={4} value={description} onChange={(event) => setDescription(event.target.value)}/>
            </label>
            <label className="form-label w-100">Статус
              <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus)}>
                {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="col-md-4">
            <label className="form-label w-100">Обложка
              <input type="file" accept="image/*" className="form-control" onChange={pickCover}/>
            </label>
            {preview && (
              <>
                <img src={preview} alt="" className="img-fluid rounded mb-2"/>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCover(null)}>Убрать обложку</button>
              </>
            )}
          </div>
          <div className="col-12">
            <div className="form-label">Игроки</div>
            <div className="row row-cols-2 row-cols-md-4 g-1">
              {users.filter((user) => user.role !== 'ГМ').map((user) => (
                <label key={user.id} className="col form-check">
                  <input type="checkbox" className="form-check-input" checked={players.includes(user.id)} onChange={() => togglePlayer(user.id)}/>
                  <span className="form-check-label">{user.username}</span>
                </label>
              ))}
              {users.length === 0 && <span className="text-muted small">Нет пользователей</span>}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn btn-primary" disabled={pending || name.trim().length < 2} onClick={submit}>
            {pending ? <Spinner/> : id ? 'Сохранить' : 'Создать кампанию'}
          </button>
          {id && <button type="button" className="btn btn-outline-danger ms-auto" disabled={pending} onClick={remove}>Удалить кампанию</button>}
        </div>
      </div>
    </div>
  )
}
