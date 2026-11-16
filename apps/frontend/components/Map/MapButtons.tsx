'use client'
//DM buttons on a map row: make it current (or clear), snapshot it into the library, delete with a confirm.
import {useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {deleteMap, saveToLibrary, setCurrentMap} from "@frontend/actions/maps"
import Spinner from "@frontend/components/UI/Spinner"

export default function MapButtons({campaignId, mapId, isCurrent}: { campaignId: string; mapId: string; isCurrent: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = (action: () => Promise<{ isSuccess: boolean; message: string }>, done?: string) => startTransition(async () => {
    setError(null)
    setNotice(null)
    const {isSuccess, message} = await action()
    if (isSuccess) { router.refresh(); if (done) setNotice(done) }
    else setError(message)
  })

  return (
    <div className="d-flex flex-wrap align-items-center gap-1 small">
      <button type="button" className={`btn btn-sm py-0 ${isCurrent ? 'btn-outline-secondary' : 'btn-outline-success'}`} disabled={pending}
              onClick={() => run(() => setCurrentMap(campaignId, isCurrent ? null : mapId))}>
        {isCurrent ? 'Убрать из игры' : 'Сделать текущей'}
      </button>
      <button type="button" className="btn btn-sm btn-outline-secondary py-0" disabled={pending} title="Снимок в общую библиотеку: картинка, сетка, туман и монстры"
              onClick={() => run(() => saveToLibrary(mapId), 'Сохранено в библиотеку карт')}>В библиотеку</button>
      {!confirming && <button type="button" className="btn btn-sm btn-outline-danger py-0" disabled={pending} onClick={() => setConfirming(true)}>Удалить</button>}
      {confirming && (
        <>
          <button type="button" className="btn btn-sm btn-danger py-0" disabled={pending} onClick={() => run(() => deleteMap(mapId, campaignId))}>Да, удалить</button>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0" disabled={pending} onClick={() => setConfirming(false)}>Отмена</button>
        </>
      )}
      {pending && <Spinner/>}
      {error && <span className="text-danger">{error}</span>}
      {notice && <span className="text-success">{notice}</span>}
    </div>
  )
}
