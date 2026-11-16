//Compendium: one subclass — its class, extra table columns, features by class level.
import Link from "next/link"
import {notFound} from "next/navigation"
import EntryPage from "@frontend/components/Compendium/EntryPage"
import FeatureTimeline from "@frontend/components/Compendium/FeatureTimeline"
import {classById, subclassById} from "@frontend/_util/compendium"

export default async function SubclassPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const subclass = subclassById(id)
  if (!subclass) notFound()
  const parent = classById(subclass.class)
  const columns = Object.values(subclass.table ?? {})

  return (
    <EntryPage section="classes" title={subclass.name}
               meta={[['Класс', <Link key="class" href={`/compendium/classes/${subclass.class}`}>{parent?.name ?? subclass.class}</Link>]]}
               description={subclass.description}>
      {columns.length > 0 && (
        <div className="table-responsive mb-3">
          <table className="table table-dark table-sm table-striped small">
            <thead><tr><th>Ур.</th>{columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead>
            <tbody>
              {Array.from({length: 20}, (_, index) => index + 1).map((level) => (
                <tr key={level}><td>{level}</td>{columns.map((column) => <td key={column.name}>{column.values[level - 1] || '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="h5">Умения</h2>
      <FeatureTimeline grants={subclass.features}/>
    </EntryPage>
  )
}
