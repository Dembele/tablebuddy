'use client'
//A signed-in page failed to render: the message, a retry, a way home. The header stays.
import Link from "next/link"
import {useEffect} from "react"

export default function PageError({error, reset}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])

  return (
    <div className="container py-4">
      <div className="alert alert-danger">
        <div className="fw-bold mb-1">Что-то пошло не так</div>
        <div className="small">{error.message || 'Неизвестная ошибка'}{error.digest && <span className="text-muted"> · {error.digest}</span>}</div>
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>Попробовать снова</button>
        <Link href="/" className="btn btn-outline-secondary btn-sm">На главную</Link>
      </div>
    </div>
  )
}
