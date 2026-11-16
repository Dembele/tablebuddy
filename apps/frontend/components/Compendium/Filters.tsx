//Search + filter bar as a plain GET form: filters live in the URL, no client code.
export interface FilterSelect {
  name: string
  label: string
  value?: string
  options: Array<[string, string]>                                                                                      //value, title
}

export default function Filters({query, selects = []}: { query?: string; selects?: FilterSelect[] }) {
  return (
    <form method="get" className="row g-2 align-items-end mb-3 small">
      <div className="col-md">
        <input name="q" defaultValue={query} className="form-control form-control-sm" placeholder="Поиск по названию"/>
      </div>
      {selects.map((select) => (
        <div key={select.name} className="col-6 col-md-auto">
          <select name={select.name} defaultValue={select.value ?? ''} className="form-select form-select-sm" aria-label={select.label}>
            <option value="">{select.label}: все</option>
            {select.options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
          </select>
        </div>
      ))}
      <div className="col-auto"><button type="submit" className="btn btn-sm btn-primary">Найти</button></div>
    </form>
  )
}
