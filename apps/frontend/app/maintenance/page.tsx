//Shown when the backend is unreachable; reachable without a session. «Try again» goes back to the page the user was
//going to (?from=, set by the session check) with a full load, so the server is asked again; no polling.
type Search = Promise<Record<string, string | string[] | undefined>>

//only paths inside this site, never back to itself
const safePath = (value: string | string[] | undefined) => {
  const path = Array.isArray(value) ? value[0] : value
  return path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/maintenance') ? path : '/'
}

export default async function MaintenancePage({searchParams}: { searchParams: Search }) {
  const back = safePath((await searchParams).from)

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100">
      <div className="card bg-dark text-center p-4" style={{maxWidth: '600px'}}>
        <div className="card-body">
          <h1 className="card-title text-danger mb-4">Технические работы</h1>
          <p className="card-text mb-4">
            Сервер сейчас недоступен. Когда он вернётся, кнопка ниже откроет страницу, на которую вы шли.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <a href={back} className="btn btn-primary">Попробовать снова</a>
            {back !== '/' && <a href="/" className="btn btn-outline-secondary">На главную</a>}
          </div>
          {back !== '/' && <div className="small text-muted mt-3">Вернёмся на <code>{back}</code></div>}
        </div>
      </div>
    </div>
  )
}
