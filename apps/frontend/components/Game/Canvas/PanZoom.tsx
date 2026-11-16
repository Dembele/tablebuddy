'use client'
//Pan / zoom viewport (pointer events): drag or middle-button to pan, wheel and pinch to zoom around the pointer, fit on first size.
//Children are drawn in map pixels; gestures below stop propagation when they take a press, so it never pans then.
//Also the map form's preview: there it zooms far in (maxScale) and reports the scale so grid lines can stay one screen pixel thin.
import {PointerEvent, ReactNode, useCallback, useEffect, useRef, useState} from "react"
import {FaExpand, FaMinus, FaPlus} from "react-icons/fa6"
import IconButton from "@frontend/components/UI/IconButton"

interface View { x: number; y: number; scale: number }

interface PanZoomProps {
  width: number
  height: number
  onTap?: () => void                                                                                                    //press + release without moving
  maxScale?: number                                                                                                     //how close the wheel may go (default 5)
  fitShare?: number                                                                                                     //share of the viewport the fitted content takes (default 0.95)
  onScale?: (scale: number) => void                                                                                     //told every time the zoom changes
  children: ReactNode
}

const minScale = 0.1
const tapDistance = 6

export default function PanZoom({width, height, onTap, maxScale = 5, fitShare = 0.95, onScale, children}: PanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({x: 0, y: 0, scale: 1})
  const viewRef = useRef(view)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pan = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null)
  const pinch = useRef<{ distance: number } | null>(null)
  const fitted = useRef('')

  const apply = useCallback((next: View) => { viewRef.current = next; setView(next) }, [])

  //zoom keeping the content point under (clientX, clientY) in place
  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const focusX = clientX === undefined ? rect.width / 2 : clientX - rect.left
    const focusY = clientY === undefined ? rect.height / 2 : clientY - rect.top
    const current = viewRef.current
    const scale = Math.min(maxScale, Math.max(minScale, current.scale * factor))
    const contentX = (focusX - current.x) / current.scale
    const contentY = (focusY - current.y) / current.scale
    apply({scale, x: focusX - contentX * scale, y: focusY - contentY * scale})
  }, [apply, maxScale])

  //the whole map centered in the viewport
  const fit = useCallback(() => {
    const container = containerRef.current
    if (!container || width < 2 || height < 2) return
    const scale = Math.min(container.clientWidth / width, container.clientHeight / height) * fitShare
    apply({scale, x: (container.clientWidth - width * scale) / 2, y: (container.clientHeight - height * scale) / 2})
  }, [width, height, apply, fitShare])

  const scaleListener = useRef(onScale)
  scaleListener.current = onScale
  useEffect(() => { scaleListener.current?.(view.scale) }, [view.scale])

  //fit once per map size
  useEffect(() => {
    const key = `${width}x${height}`
    if (fitted.current === key || width < 2 || height < 2) return
    fitted.current = key
    fit()
  }, [width, height, fit])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY) }
    container.addEventListener('wheel', wheel, {passive: false})
    return () => container.removeEventListener('wheel', wheel)
  }, [zoomAt])

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY})
    containerRef.current?.setPointerCapture(event.pointerId)
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      pinch.current = {distance: Math.hypot(second.x - first.x, second.y - first.y)}
      pan.current = null
      return
    }
    pan.current = {startX: event.clientX, startY: event.clientY, viewX: viewRef.current.x, viewY: viewRef.current.y, moved: false}
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY})
    if (pinch.current && pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(second.x - first.x, second.y - first.y)
      zoomAt(distance / pinch.current.distance, (first.x + second.x) / 2, (first.y + second.y) / 2)
      pinch.current = {distance}
      return
    }
    const drag = pan.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.hypot(dx, dy) > tapDistance) drag.moved = true
    if (drag.moved) apply({...viewRef.current, x: drag.viewX + dx, y: drag.viewY + dy})
  }

  const onPointerUp = (event: PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pan.current && !pan.current.moved && pointers.current.size === 0) onTap?.()
    if (pointers.current.size === 0) pan.current = null
  }

  return (
    <div ref={containerRef} className="position-relative overflow-hidden flex-grow-1" style={{touchAction: 'none', cursor: pan.current?.moved ? 'grabbing' : 'grab'}}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
         onContextMenu={(event) => event.preventDefault()}>
      <div className="position-absolute top-0 start-0" style={{width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0'}}>
        {children}
      </div>
      <div className="room__zoom" onPointerDown={(event) => event.stopPropagation()}>
        <IconButton solid label="Приблизить" icon={<FaPlus/>} onClick={() => zoomAt(1.2)}/>
        <IconButton solid label="Отдалить" icon={<FaMinus/>} onClick={() => zoomAt(1 / 1.2)}/>
        <IconButton solid label="Вся карта" icon={<FaExpand/>} onClick={fit}/>
      </div>
    </div>
  )
}
