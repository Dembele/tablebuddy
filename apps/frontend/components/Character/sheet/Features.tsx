//Taken features, one line each: name (links to its rules text in the compendium), origin, picks by name.
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {choiceAnswerName} from "@frontend/deps/builder/_index"
import {featureOf, sourceLabel} from "@frontend/_util/rulebook"
import Block from "@frontend/components/Character/sheet/Block"
import Link from "next/link"

export default function Features({character}: { character: EvaluatedCharacter }) {
  return (
    <Block title="Умения и черты">
      {character.features.length === 0 && <p className="text-muted small mb-0">Пока ничего.</p>}
      <ul className="list-unstyled small mb-0">
        {character.features.map((instance, index) => {
          const feature = featureOf(instance.featureId)
          const picks = Object.entries(instance.choices ?? {}).flatMap(([choiceId, ids]) =>
            [ids].flat().map((id) => choiceAnswerName(instance.featureId, choiceId, id)))
          return (
            <li key={`${instance.featureId}-${index}`} className="mb-1">
              {feature
                ? <Link href={`/compendium/features/${instance.featureId}`} className="fw-bold text-reset">{feature.name}</Link>
                : <span className="fw-bold" title="Нет в справочнике">{instance.featureId}</span>}
              <span className="badge text-bg-secondary ms-2">{sourceLabel(instance.from)}</span>
              {picks.length > 0 && <span className="text-primary ms-2">{picks.join(', ')}</span>}
            </li>
          )
        })}
      </ul>
    </Block>
  )
}
