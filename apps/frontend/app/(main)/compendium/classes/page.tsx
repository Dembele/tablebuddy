//Compendium: the twelve classes with their subclasses.
import Link from "next/link"
import CompendiumNav from "@frontend/components/Compendium/CompendiumNav"
import {allClasses, allSubclasses} from "@frontend/_util/compendium"
import {attributeMap} from "@frontend/deps/types/Attribute"

export default function ClassesPage() {
  return (
    <div className="container">
      <CompendiumNav active="classes"/>
      <div className="row g-3">
        {[...allClasses].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => (
          <div key={entry.id} className="col-md-6 col-lg-4">
            <div className="card bg-dark h-100">
              <div className="card-body">
                <h2 className="h5"><Link href={`/compendium/classes/${entry.id}`}>{entry.name}</Link></h2>
                <div className="small text-muted mb-2">
                  к{entry.hitDie} · {entry.primaryAbility.attributes.map((attribute) => attributeMap[attribute]).join(entry.primaryAbility.mode === 'all' ? ' и ' : ' или ')}
                  {entry.spellcasting && ' · заклинатель'}
                </div>
                <div className="small">
                  {allSubclasses.filter((subclass) => subclass.class === entry.id).map((subclass) => (
                    <Link key={subclass.id} href={`/compendium/subclasses/${subclass.id}`} className="me-2 d-inline-block">{subclass.name}</Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
