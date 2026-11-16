//Round portrait (design guide §5): the picture, or placeholder letters — first letter plus a trailing number so «Гоблин 3» reads «Г3».
import {CSSProperties} from "react"

interface AvatarProps {
  name: string
  src?: string | null
  size?: number                                                                                                         //px; default 32 (.tb-avatar)
  tone?: 'dm' | 'player'                                                                                                //ring in the role colour
  title?: string
}

export const initialsOf = (name: string) => `${name.trim().slice(0, 1)}${name.match(/\s(\d+)$/)?.[1] ?? ''}`

export default function Avatar({name, src, size, tone, title}: AvatarProps) {
  const className = `tb-avatar${tone ? ` tb-avatar--${tone}` : ''}`
  const style = size ? {'--size': `${size}px`} as CSSProperties : undefined
  if (src) return <img src={src} alt="" title={title} className={className} style={style} draggable={false}/>
  return <span className={className} style={style} title={title} aria-hidden>{initialsOf(name)}</span>
}
