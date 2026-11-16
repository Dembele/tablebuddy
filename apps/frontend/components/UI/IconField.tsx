//Labelled input with a leading icon and its own error line.
import {ReactNode} from "react"

interface IconFieldProps {
  name: string
  label: string
  icon: ReactNode
  type?: string
  error?: string
}

export default function IconField({name, label, icon, type = 'text', error}: IconFieldProps) {
  return (
    <div className="mb-3">
      <label htmlFor={name} className="form-label">{label}</label>
      <div className="input-group">
        <span className="input-group-text">{icon}</span>
        <input type={type} className="form-control" id={name} name={name} required/>
      </div>
      {error && <div className="alert alert-danger mt-2 py-1">{error}</div>}
    </div>
  )
}
