//Compendium detail page frame: back link, title, subtitle line, key/value meta rows, rules text.
import Link from "next/link"
import {ReactNode} from "react"
import CompendiumNav, {Section} from "@frontend/components/Compendium/CompendiumNav"

interface EntryPageProps {
  section: Section
  title: string
  subtitle?: string
  meta?: Array<[string, ReactNode]>
  description?: string
  children?: ReactNode
}

export default function EntryPage({section, title, subtitle, meta = [], description, children}: EntryPageProps) {
  return (
    <div className="container">
      <CompendiumNav active={section}/>
      <Link href={`/compendium/${section}`} className="small">← к списку</Link>
      <h1 className="h3 mb-0 mt-1">{title}</h1>
      {subtitle && <div className="text-muted mb-2">{subtitle}</div>}
      {meta.length > 0 && (
        <dl className="row small mb-2">
          {meta.map(([label, value]) => (
            <div key={label} className="col-sm-6 col-lg-4 d-flex gap-2"><dt className="text-muted fw-normal">{label}:</dt><dd className="mb-1">{value}</dd></div>
          ))}
        </dl>
      )}
      {description && <div className="description mb-3">{description}</div>}
      {children}
    </div>
  )
}
