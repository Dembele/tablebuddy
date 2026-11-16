'use client'
//Library map buttons: delete from the library (with a confirm), and import a copy into a campaign.
import {useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {deleteMap, importFromLibrary} from "@frontend/actions/maps"
import Spinner from "@frontend/components/UI/Spinner"

//removes the library entry only: campaign maps imported from it are copies and stay
export function LibraryDelete({mapId}: { mapId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const remove = () => startTransition(async () => {
    const {isSuccess, message} = await deleteMap(mapId)
    if (isSuccess) router.refresh()
    else setError(message)
  })

  return (
    <div className="d-flex flex-wrap align-items-center gap-1 small">
      {!confirming && <button type="button" className="btn btn-sm btn-outline-danger py-0" disabled={pending} onClick={() => setConfirming(true)}>Удалить</button>}
      {confirming && (
        <>
          <button type="button" className="btn btn-sm btn-danger py-0" disabled={pending} onClick={remove}>Да, удалить из библиотеки</button>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0" disabled={pending} onClick={() => setConfirming(false)}>Отмена</button>
        </>
      )}
      {pending && <Spinner/>}
      {error && <span className="text-danger">{error}</span>}
    </div>
  )
}

//a copy of the library map becomes the campaign's own; back to the campaign page after
export function ImportButton({libraryId, campaignId}: { libraryId: string; campaignId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const importMap = () => startTransition(async () => {
    setError(null)
    const {data, message} = await importFromLibrary(libraryId, campaignId)
    if (!data?._id) return setError(message)
    router.push(`/campaigns/${campaignId}`)
    router.refresh()
  })

  return (
    <div className="d-flex flex-wrap align-items-center gap-1 small">
      <button type="button" className="btn btn-sm btn-primary py-0" disabled={pending} onClick={importMap}>Взять в кампанию</button>
      {pending && <Spinner/>}
      {error && <span className="text-danger">{error}</span>}
    </div>
  )
}
