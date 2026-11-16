'use client'
//Condition icons (react-icons, Game Icons set) and the small badge row shown on map tokens, panels and the selection card.
//Display only: conditions are state the DM sets by hand (quick controls); nothing reads them.
import {IconType} from "react-icons"
import {GiBlindfold, GiCancel, GiCharm, GiFallDown, GiFrozenBody, GiGrab, GiInvisible, GiNightSleep, GiPoisonBottle, GiRopeCoil, GiSleepy,
  GiSoundOff, GiStarSwirl, GiStoneBust, GiTerror, GiTiredEye} from "react-icons/gi"
import {conditionMap, ENCondition} from "@frontend/deps/types/Condition"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"

export const conditionIcons: Record<ENCondition, IconType> = {
  blinded: GiBlindfold,
  charmed: GiCharm,
  deafened: GiSoundOff,
  exhaustion: GiTiredEye,
  frightened: GiTerror,
  grappled: GiGrab,
  incapacitated: GiCancel,
  invisible: GiInvisible,
  paralyzed: GiFrozenBody,
  petrified: GiStoneBust,
  poisoned: GiPoisonBottle,
  prone: GiFallDown,
  restrained: GiRopeCoil,
  stunned: GiStarSwirl,
  unconscious: GiSleepy,
  asleep: GiNightSleep
}

//the ones that take a creature out of the fight read red, the rest amber
const severe: ENCondition[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']
export const conditionColor = (condition: ENCondition) => severe.includes(condition) ? '#f87171' : '#fbbf24'

type Conditions = EvaluatedCharacter['conditions']

//a row of round badges; `limit` collapses the rest into «+N»
export function ConditionBadges({conditions, size, limit = conditions.length}: { conditions: Conditions; size: number; limit?: number }) {
  if (!conditions.length) return null
  const shown = conditions.slice(0, limit)
  const badge = {width: size, height: size, fontSize: size * 0.72, lineHeight: 1}
  return (
    <>
      {shown.map(({condition, level}) => {
        const Icon = conditionIcons[condition] ?? GiCancel
        const title = `${conditionMap[condition] ?? condition}${level ? ` ${level}` : ''}`
        return (
          <span key={condition} title={title} className="position-relative d-inline-flex align-items-center justify-content-center rounded-circle"
                style={{...badge, background: 'rgba(15,15,15,.88)', color: conditionColor(condition), boxShadow: '0 0 0 1px rgba(0,0,0,.6)'}}>
            <Icon aria-label={title}/>
            {level ? <span className="position-absolute fw-bold text-white" style={{fontSize: size * 0.5, right: -size * 0.15, bottom: -size * 0.2}}>{level}</span> : null}
          </span>
        )
      })}
      {conditions.length > shown.length && (
        <span className="d-inline-flex align-items-center justify-content-center rounded-circle text-white fw-bold" style={{...badge, fontSize: size * 0.45, background: 'rgba(15,15,15,.88)'}}
              title={conditions.slice(limit).map(({condition}) => conditionMap[condition]).join(', ')}>+{conditions.length - shown.length}</span>
      )}
    </>
  )
}

//death save track at 0 HP: successes green | failures red, or «стаб.» once stable
export function DeathSaves({saves, size}: { saves: EvaluatedCharacter['deathSavingThrows']; size: number }) {
  const pill = {fontSize: size, lineHeight: 1.15, padding: `0 ${size * 0.35}px`, background: 'rgba(15,15,15,.88)', boxShadow: '0 0 0 1px rgba(0,0,0,.6)'}
  if (saves.isStable) return <span className="rounded-pill fw-bold" style={{...pill, color: '#4ade80'}} title="Стабилен">стаб.</span>
  return (
    <span className="rounded-pill fw-bold" style={pill} title={`Спасброски от смерти: успехов ${saves.success}, провалов ${saves.failure}`}>
      <span style={{color: '#4ade80'}}>{saves.success}</span><span className="text-secondary">|</span><span style={{color: '#f87171'}}>{saves.failure}</span>
    </span>
  )
}
