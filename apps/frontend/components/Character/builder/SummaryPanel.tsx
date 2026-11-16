//Live preview of the builder draft, plus what the builder leaves to the user.
import type {Summary} from "@frontend/_util/buildSummary"

export default function SummaryPanel({summary, notes}: { summary: Summary; notes: string[] }) {
  return (
    <div className="card bg-dark sticky-top" style={{top: 72}}>
      <div className="card-header fw-bold text-primary">{summary.title}</div>
      <div className="card-body small" style={{maxHeight: '75vh', overflowY: 'auto'}}>
        <div className="d-flex flex-wrap gap-1 mb-2">
          {summary.attributes.map((attribute) => (
            <span key={attribute.name} className={`badge border ${attribute.save ? 'border-primary text-primary' : 'text-light'}`}>
              {attribute.name.slice(0, 3)} {attribute.value}
            </span>
          ))}
        </div>
        {summary.lines.map((line) => <div key={line.label}><span className="text-muted">{line.label}:</span> {line.value}</div>)}
        {summary.features.length > 0 && (
          <>
            <div className="text-muted mt-2">Умения</div>
            <ul className="mb-0 ps-3">{summary.features.map((feature, index) => <li key={index}>{feature.name}{feature.picks && <span className="text-primary"> ({feature.picks})</span>} <span className="text-muted">· {feature.source}</span></li>)}</ul>
          </>
        )}
        {summary.spells.length > 0 && (
          <>
            <div className="text-muted mt-2">Заклинания</div>
            <ul className="mb-0 ps-3">{summary.spells.map((spell, index) => <li key={index}>{spell.level ? `${spell.level}: ` : ''}{spell.name} <span className="text-muted">· {spell.source}</span></li>)}</ul>
          </>
        )}
        {summary.inventory.length > 0 && <div className="mt-2"><span className="text-muted">Снаряжение:</span> {summary.inventory.join(', ')}</div>}
        {notes.length > 0 && <div className="alert alert-info py-1 mt-2 mb-0">{notes.map((note, index) => <div key={index}>{note}</div>)}</div>}
      </div>
    </div>
  )
}
