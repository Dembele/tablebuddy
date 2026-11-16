//Shown while a signed-in page loads on the server.
export default function Loading() {
  return (
    <div className="container d-flex align-items-center gap-2 text-muted py-5">
      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"/> Загрузка…
    </div>
  )
}
