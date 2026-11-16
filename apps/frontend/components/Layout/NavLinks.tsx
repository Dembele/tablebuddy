'use client'
//Header sections with the current one highlighted (by path prefix).
import Link from "next/link"
import {usePathname} from "next/navigation"

export default function NavLinks({links}: { links: Array<[string, string]> }) {
  const pathname = usePathname()
  return (
    <ul className="navbar-nav flex-row flex-wrap gap-3 me-auto ms-4">
      {links.map(([href, title]) => (
        <li key={href} className="nav-item">
          <Link href={href} className={`nav-link ${pathname.startsWith(href) ? 'active fw-bold' : ''}`} aria-current={pathname.startsWith(href) ? 'page' : undefined}>{title}</Link>
        </li>
      ))}
    </ul>
  )
}
