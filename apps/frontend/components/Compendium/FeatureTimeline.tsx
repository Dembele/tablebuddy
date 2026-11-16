//Features granted by level (class, subclass, species): name links, rules text inline, «or pick from» lists.
import Link from "next/link"
import {FeatureGrant} from "@frontend/deps/types/book/features"
import {featureById} from "@frontend/_util/compendium"

export default function FeatureTimeline({grants, showLevel = true}: { grants: FeatureGrant[]; showLevel?: boolean }) {
  return (
    <div>
      {[...grants].sort((a, b) => a.level - b.level).map((grant, index) => {
        const feature = featureById(grant.feature)
        return (
          <div key={`${grant.feature}-${index}`} className="mb-2 pb-2 border-bottom border-secondary-subtle">
            <div>
              {showLevel && <span className="badge text-bg-secondary me-2">{grant.level} ур.</span>}
              <Link href={`/compendium/features/${grant.feature}`} className="fw-bold">{feature?.name ?? grant.feature}</Link>
            </div>
            {feature?.description && <div className="description small text-light-emphasis mt-1">{feature.description}</div>}
            {grant.choices && grant.choices.length > 0 && (
              <div className="small mt-1">Или на выбор: {grant.choices.map((choice, position) => (
                <span key={choice}>{position > 0 && ', '}<Link href={`/compendium/features/${choice}`}>{featureById(choice)?.name ?? choice}</Link></span>
              ))}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
