//Top bar: brand, main sections (current one marked), user menu with profile and logout (a server action form).
import Link from 'next/link'
import {FaDiceD20, FaUser} from 'react-icons/fa'
import {UserSafe} from "@frontend/deps/interfaces/DB/User"
import {logout} from "@frontend/actions/auth"
import NavLinks from "@frontend/components/Layout/NavLinks"

export default function Header({user}: { user: UserSafe }) {
  return (
    <header className="site-header bg-dark text-light shadow-sm border-bottom border-black-subtle">
      <nav className="navbar navbar-dark">
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center">
            <FaDiceD20 className="me-2 text-primary" size={24}/>
            <span className="fw-bold">TableBuddy</span>
          </Link>

          <NavLinks links={[
            ['/campaigns', 'Кампании'], ['/characters', 'Персонажи'], ['/compendium', 'Справочник'],
            ...(user.role === 'ГМ' ? [['/maps', 'Карты'] as [string, string], ['/users', 'Пользователи'] as [string, string]] : [])
          ]}/>

          <div className="dropdown">
            <button className="btn btn-outline-light dropdown-toggle d-flex align-items-center" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <FaUser className="me-1"/>{user.username}
            </button>
            <ul className="dropdown-menu dropdown-menu-end" style={{zIndex: 9999}}>
              <li><span className="dropdown-item-text text-muted small">{user.role}</span></li>
              <li><Link href="/profile" className="dropdown-item">Профиль</Link></li>
              <li><hr className="dropdown-divider"/></li>
              <li>
                <form action={logout}>
                  <button type="submit" className="dropdown-item">Выход</button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  )
}
