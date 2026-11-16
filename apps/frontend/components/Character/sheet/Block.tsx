//Card frame shared by every sheet block. `fold` = a block needed now and then (profile, token, access): closed, with a digest in its header.
import {ReactNode} from "react"
import Fold from "@frontend/components/UI/Fold"

interface BlockProps {
  title: string
  children: ReactNode
  className?: string
  fold?: boolean
  digest?: ReactNode
}

export default function Block({title, children, className = '', fold, digest}: BlockProps) {
  if (fold) return <Fold title={title} digest={digest} className={className}>{children}</Fold>
  return (
    <section className={`card bg-dark h-100 ${className}`}>
      <div className="card-header py-2 fw-bold text-primary">{title}</div>
      <div className="card-body py-2">{children}</div>
    </section>
  )
}
