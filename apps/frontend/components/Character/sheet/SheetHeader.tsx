//Name, origin line, classes and level; a stat-block character shows its monster line and a compendium link instead.
import Link from "next/link"
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {backgroundName, className, raceName, subclassName} from "@frontend/_util/rulebook"
import {sizeMap} from "@frontend/deps/types/Race"
import {DeleteCharacterButton, LevelUpSwitch} from "@frontend/components/Character/sheet/SheetButtons"
import {monsterLine} from "@frontend/components/Compendium/StatBlock"
import {monsterById} from "@frontend/_util/compendium"

//builder entry points by state and role; the raw editor is the DM's, deleting the DM's and the owner's
export default function SheetHeader({character, isDM, isOwner}: { character: EvaluatedCharacter; isDM: boolean; isOwner: boolean }) {
  const level = character.classes.reduce((total, entry) => total + entry.level, 0)
  const monster = character.monster ? monsterById(character.monster) : undefined
  const classes = character.classes.map((entry) =>
    `${className(entry.class)}${entry.subclass ? ` (${subclassName(entry.subclass)})` : ''} ${entry.level}`).join(' / ')

  return (
    <div className="card bg-dark mb-3">
      <div className="card-body d-flex flex-wrap gap-3 align-items-center">
        {character.avatar && <img src={character.avatar} alt="" width={72} height={72} className="rounded-circle object-fit-cover"/>}
        <div className="flex-grow-1">
          <h1 className="h3 mb-1">{character.name === 'not_init' ? 'Новый персонаж' : character.name}</h1>
          {monster ? (
            <>
              <div>{monsterLine(monster)}</div>
              <div className="text-muted small">Опасность {monster.challenge.rating} · <Link href={`/compendium/monsters/${monster.id}`}>{monster.name} в бестиарии</Link></div>
            </>
          ) : (
            <>
              <div>{[character.race && raceName(character.race), character.size && sizeMap[character.size], character.background && backgroundName(character.background)].filter(Boolean).join(' · ')}</div>
              <div className="text-muted small">{classes || 'Без класса'}{level ? ` · уровень ${level}` : ''} · опыт {character.xp}</div>
            </>
          )}
        </div>
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
          {!monster && character.classes.length === 0 && <Link href={`/characters/${character._id}/build`} className="btn btn-primary">Создать с помощником</Link>}
          {character.classes.length > 0 && level < 20 && (isDM || character.levelUpAllowed) && (
            <Link href={`/characters/${character._id}/level-up`} className={`btn btn-sm ${isDM ? 'btn-outline-primary' : 'btn-primary'}`}>Повысить уровень</Link>
          )}
          {isDM && character.classes.length > 0 && level < 20 && <LevelUpSwitch characterId={String(character._id)} allowed={!!character.levelUpAllowed}/>}
          {isDM && <Link href={`/characters/${character._id}/edit`} className="btn btn-sm btn-outline-secondary">Редактировать</Link>}
          {(isDM || isOwner) && <DeleteCharacterButton characterId={String(character._id)} name={character.name === 'not_init' ? 'Новый персонаж' : character.name}/>}
        </div>
      </div>
    </div>
  )
}
