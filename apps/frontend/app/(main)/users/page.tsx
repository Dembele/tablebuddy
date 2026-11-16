//DM: every registered user with a role switch and password reset (roles are read per request, so a switch takes effect at once).
import {requireAdmin} from "@frontend/_util/session"
import {listUsers} from "@frontend/actions/campaigns"
import UserButtons from "@frontend/app/(main)/users/page.client"

export default async function UsersPage() {
  const me = await requireAdmin()
  const {data: users, message} = await listUsers()

  return (
    <div className="container">
      <h1 className="h3 mb-3">Пользователи</h1>
      {!users && <div className="alert alert-danger">{message}</div>}
      <ul className="list-group">
        {(users ?? []).map((user) => (
          <li key={String(user._id)} className="list-group-item bg-dark d-flex align-items-center gap-3">
            <span className="flex-grow-1">{user.username}{String(user._id) === String(me._id) && <span className="text-muted small ms-2">(вы)</span>}</span>
            <span className={`badge ${user.role === 'ГМ' ? 'text-bg-warning' : 'text-bg-secondary'}`}>{user.role}</span>
            {String(user._id) !== String(me._id) && <UserButtons userId={String(user._id)} role={user.role}/>}
          </li>
        ))}
      </ul>
    </div>
  )
}
