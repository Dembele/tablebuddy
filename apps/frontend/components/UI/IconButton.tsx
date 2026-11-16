//Icon-only button (design guide §5): the label is required — it is the tooltip and the accessible name.
import {ButtonHTMLAttributes, ReactNode} from "react"

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'aria-label'> {
  label: string
  icon: ReactNode
  active?: boolean
  size?: 'sm' | 'lg'
  tone?: 'danger'
  solid?: boolean                                                                                                       //own surface, for buttons floating over the map
}

export default function IconButton({label, icon, active, size, tone, solid, className = '', ...rest}: IconButtonProps) {
  const classes = ['tb-icon-btn', size && `tb-icon-btn--${size}`, tone && `tb-icon-btn--${tone}`, solid && 'tb-icon-btn--solid', active && 'is-active', className]
  return <button type="button" {...rest} title={label} aria-label={label} aria-pressed={active} className={classes.filter(Boolean).join(' ')}>{icon}</button>
}
