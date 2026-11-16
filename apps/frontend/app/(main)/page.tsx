//Home: my campaigns and characters at a glance, a compendium search, DM shortcuts.
import Link from "next/link"
import {requireUser} from "@frontend/_util/session"
import {listCampaignEntries} from "@frontend/actions/campaigns"
import {listCharacters} from "@frontend/actions/characters"
import {className} from "@frontend/_util/rulebook"

export default async function HomePage() {
  const [user, {data: campaigns}, {data: characters}] = await Promise.all([requireUser(), listCampaignEntries(), listCharacters()])
  const isDM = user.role === 'ГМ'
  const mine = (characters ?? []).filter((character) => String(character.owner) === String(user._id) || isDM).slice(0, 8)

  return (
    <div className="container">
      <h1 className="h3 mb-3">Привет, {user.username}</h1>

      <form action="/compendium" method="get" className="d-flex gap-2 mb-4" style={{maxWidth: 520}}>
        <input name="q" className="form-control form-control-sm" placeholder="Справочник: заклинание, предмет, черта…"/>
        <button type="submit" className="btn btn-sm btn-primary">Найти</button>
      </form>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card bg-dark h-100">
            <div className="card-header fw-bold text-primary d-flex justify-content-between">
              <Link href="/campaigns">Кампании</Link>
              {isDM && <Link href="/campaigns/new" className="small">Новая</Link>}
            </div>
            <ul className="list-group list-group-flush">
              {(campaigns ?? []).slice(0, 8).map((campaign) => (
                <li key={String(campaign._id)} className="list-group-item bg-dark d-flex justify-content-between">
                  <Link href={`/campaigns/${campaign._id}`}>{campaign.name}</Link>
                  <span className="small text-muted">{campaign.status}</span>
                </li>
              ))}
              {campaigns?.length === 0 && <li className="list-group-item bg-dark text-muted small">{isDM ? 'Кампаний пока нет — создайте первую.' : 'Вас пока не добавили ни в одну кампанию.'}</li>}
            </ul>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card bg-dark h-100">
            <div className="card-header fw-bold text-primary d-flex justify-content-between">
              <Link href="/characters">{isDM ? 'Персонажи' : 'Мои персонажи'}</Link>
              <Link href="/characters" className="small">Создать</Link>
            </div>
            <ul className="list-group list-group-flush">
              {mine.map((character) => (
                <li key={String(character._id)} className="list-group-item bg-dark d-flex justify-content-between">
                  <Link href={`/characters/${character._id}`}>{character.name === 'not_init' ? 'Новый персонаж' : character.name}</Link>
                  <span className="small text-muted">{character.classes.map((entry) => `${className(entry.class)} ${entry.level}`).join(' / ') || 'без класса'}</span>
                </li>
              ))}
              {mine.length === 0 && <li className="list-group-item bg-dark text-muted small">Персонажей пока нет.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
