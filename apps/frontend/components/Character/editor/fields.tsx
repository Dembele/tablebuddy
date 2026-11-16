'use client'
//Small controlled inputs for the editor; each writes one path through `set`. `bare` drops the visible label (rows under a header line).
import {ReactNode, useState} from "react"
import {SetField} from "@frontend/components/Character/editor/useDraft"
import Fold from "@frontend/components/UI/Fold"

export interface Option {
  id: string
  name: string
}

//editor section: what changes in play is open, the rest folds to a one-line digest (design guide: every state speaks)
export function Section({title, digest, open, children}: { title: string; digest?: ReactNode; open?: boolean; children: ReactNode }) {
  return <Fold title={title} digest={digest} open={open} className="mb-2">{children}</Fold>
}

const labelClass = (bare?: boolean) => bare ? 'visually-hidden' : ''
const wrapClass = (bare?: boolean) => bare ? 'd-block m-0' : 'form-label w-100 small'

export function TextField({label, path, value, set, monospace, bare}: { label: string; path: string; value: string | undefined; set: SetField; monospace?: boolean; bare?: boolean }) {
  return (
    <label className={wrapClass(bare)}>
      <span className={labelClass(bare)}>{label}</span>
      <input className={`form-control form-control-sm ${monospace ? 'font-monospace' : ''}`} value={value ?? ''} onChange={(event) => set(path, event.target.value)}/>
    </label>
  )
}

//a formula or other single field on one line: label left, input right (long lists stay scannable)
export function InlineField({label, path, value, set}: { label: string; path: string; value: string | undefined; set: SetField }) {
  return (
    <label className="tb-kv">
      <span>{label}</span>
      <input className="form-control form-control-sm font-monospace" value={value ?? ''} onChange={(event) => set(path, event.target.value)}/>
    </label>
  )
}

//empty input stores undefined unless `required`
export function NumberField({label, path, value, set, required, min, max, bare}: { label: string; path: string; value: number | undefined; set: SetField; required?: boolean; min?: number; max?: number; bare?: boolean }) {
  return (
    <label className={wrapClass(bare)}>
      <span className={labelClass(bare)}>{label}</span>
      <input type="number" inputMode="numeric" className="form-control form-control-sm" value={value ?? ''} min={min} max={max}
             onChange={(event) => set(path, event.target.value === '' ? (required ? 0 : undefined) : Number(event.target.value))}/>
    </label>
  )
}

export function CheckField({label, path, value, set}: { label: string; path: string; value: boolean | undefined; set: SetField }) {
  return (
    <label className="form-check small mb-0">
      <input type="checkbox" className="form-check-input" checked={!!value} onChange={(event) => set(path, event.target.checked)}/>
      <span className="form-check-label">{label}</span>
    </label>
  )
}

export function SelectField({label, path, value, options, set, empty, bare}: { label: string; path: string; value: string | undefined; options: Option[]; set: SetField; empty?: string; bare?: boolean }) {
  return (
    <label className={wrapClass(bare)}>
      <span className={labelClass(bare)}>{label}</span>
      <select className="form-select form-select-sm" value={value ?? ''} onChange={(event) => set(path, event.target.value || undefined)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

//checkbox grid over a list of ids stored as an array
export function MultiCheck({path, values, options, set}: { path: string; values: string[]; options: Option[]; set: SetField }) {
  const toggle = (id: string) => set(path, values.includes(id) ? values.filter((value) => value !== id) : [...values, id])
  return (
    <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-1">
      {options.map((option) => (
        <label key={option.id} className="col form-check small">
          <input type="checkbox" className="form-check-input" checked={values.includes(option.id)} onChange={() => toggle(option.id)}/>
          <span className="form-check-label">{option.name}</span>
        </label>
      ))}
    </div>
  )
}

//a list of ids as chips of what is picked; the full checkbox grid opens only to change it
export function ChipPick({title, path, values, options, set}: { title: string; path: string; values: string[]; options: Option[]; set: SetField }) {
  const [editing, setEditing] = useState(false)
  const names = new Map(options.map((option) => [option.id, option.name]))
  return (
    <div className="mb-2">
      <div className="d-flex flex-wrap align-items-center gap-1">
        <span className="tb-eyebrow me-1">{title}</span>
        {values.map((value) => <span key={value} className="tb-chip">{names.get(value) ?? value}</span>)}
        {values.length === 0 && <span className="text-muted small">нет</span>}
        <button type="button" className="btn btn-link btn-sm p-0 ms-1" aria-expanded={editing} onClick={() => setEditing((current) => !current)}>{editing ? 'готово' : 'изменить'}</button>
      </div>
      {editing && <div className="mt-1 ps-1"><MultiCheck path={path} values={values} options={options} set={set}/></div>}
    </div>
  )
}
