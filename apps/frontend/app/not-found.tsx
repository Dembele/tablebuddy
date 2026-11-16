//404 page.
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="d-flex flex-column min-vh-100 justify-content-center align-items-center p-4">
      <div className="container">
        <div className="row justify-content-center align-items-center">
          <div className="col-md-8 text-center bg rounded">
            <h1 className="display-1 fw-bold mb-4 text-primary">404</h1>
            <div className='d-flex justify-content-evenly align-items-center'>
              <div>
                <img
                  className="img-fluid"
                  src={'/404.webp'}
                  alt="Confused doodle"
                  style={{ maxWidth: '200px' }}
                />
              </div>
              <div >
                <h2 className="h2 mb-3">Упс! Страница не найдена 0_о</h2>
                <p className="lead mb-4">
                  Что бы вы не искали, этого не существует<br />
                  (ну или не там искали, хз).
                </p>
              </div>
            </div>

            <div className="text-center mb-3">
              <Link href="/" className="btn btn-primary btn-lg px-4 py-2">
                На главную
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}