//Compendium section tabs; `active` marks the current one.
import Link from "next/link"

export const sections = [
  ['spells', 'Заклинания'], ['items', 'Предметы'], ['features', 'Черты и умения'],
  ['classes', 'Классы'], ['species', 'Виды'], ['backgrounds', 'Предыстории'], ['monsters', 'Бестиарий']
] as const

export type Section = typeof sections[number][0]

export default function CompendiumNav({active}: { active?: Section }) {
  return (
    <ul className="nav nav-pills flex-wrap gap-1 mb-3 small">
      <li className="nav-item"><Link href="/compendium" className={`nav-link py-1 ${active ? '' : 'active'}`}>Справочник</Link></li>
      {sections.map(([key, title]) => (
        <li key={key} className="nav-item"><Link href={`/compendium/${key}`} className={`nav-link py-1 ${active === key ? 'active' : ''}`}>{title}</Link></li>
      ))}
    </ul>
  )
}
