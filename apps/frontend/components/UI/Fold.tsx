//Collapsible card (design guide §5): the header is the switch; while closed, a one-line digest says what is inside,
//so rarely needed blocks stay out of the way without hiding their state. Plain <details>: works in server components too.
import {ReactNode} from "react"

interface FoldProps {
  title: string
  digest?: ReactNode                                                                                                    //shown in the header while closed
  open?: boolean                                                                                                        //initial state; the user's own toggling is kept
  className?: string
  children: ReactNode
}

export default function Fold({title, digest, open, className = '', children}: FoldProps) {
  return (
    <details className={`card bg-dark tb-fold ${className}`} open={open}>
      <summary className="card-header fw-bold text-primary">
        <span>{title}</span>
        {digest !== undefined && digest !== '' && <span className="tb-fold__digest">{digest}</span>}
      </summary>
      <div className="card-body">{children}</div>
    </details>
  )
}
