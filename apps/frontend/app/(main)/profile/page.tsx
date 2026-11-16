//Own profile: who I am, role, since when; password change.
import {requireUser} from "@frontend/_util/session"
import PasswordForm from "@frontend/app/(main)/profile/page.client"

export default async function ProfilePage() {
  const user = await requireUser('/profile')

  return (
    <div className="container" style={{maxWidth: 560}}>
      <h1 className="h3 mb-3">Профиль</h1>
      <dl className="row small">
        <dt className="col-4 text-muted fw-normal">Имя</dt><dd className="col-8">{user.username}</dd>
        <dt className="col-4 text-muted fw-normal">Роль</dt><dd className="col-8">{user.role}</dd>
        <dt className="col-4 text-muted fw-normal">С нами с</dt><dd className="col-8">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</dd>
      </dl>
      <div className="card bg-dark">
        <div className="card-header fw-bold text-primary">Смена пароля</div>
        <div className="card-body"><PasswordForm/></div>
      </div>
    </div>
  )
}
