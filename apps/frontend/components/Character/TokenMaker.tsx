'use client'
//Token maker: pick / drop a picture (or re-crop the stored one), drag the circle, wheel or slider to size it, border style; live preview.
//Saves the 256 px round token as the avatar and the downscaled source as `image`, so the token can be re-cropped later —
//onto a character, or (`monsterId`, DM) into the monster token pack that templates from that monster start with.
import {ChangeEvent, DragEvent, PointerEvent, useCallback, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {updateProfile} from "@frontend/actions/characters"
import {saveMonsterToken} from "@frontend/actions/monsters"
import Spinner from "@frontend/components/UI/Spinner"

const tokenSize = 256
const maxSourceSide = 1200                                                                                              //the backend keeps `image` at most this wide
const maxFileBytes = 15 * 1024 * 1024
const borderStyles = [['solid', 'Сплошная'], ['dashed', 'Пунктир'], ['dotted', 'Точки'], ['double', 'Двойная'], ['none', 'Без рамки']] as const
type BorderStyle = typeof borderStyles[number][0]

interface Circle { x: number; y: number; radius: number }                                                              //in source image pixels

//the token as drawn: crop circle → round picture, border on top
function drawToken(canvas: HTMLCanvasElement, image: HTMLImageElement, circle: Circle, border: { width: number; color: string; style: BorderStyle }) {
  const context = canvas.getContext('2d')
  if (!context) return
  const size = canvas.width
  const scale = size / tokenSize
  context.clearRect(0, 0, size, size)
  context.save()
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(image, circle.x - circle.radius, circle.y - circle.radius, circle.radius * 2, circle.radius * 2, 0, 0, size, size)
  context.restore()
  if (border.style === 'none' || border.width <= 0) return

  const width = border.width * scale
  context.strokeStyle = border.color
  context.lineWidth = border.style === 'double' ? Math.max(1, width / 3) : width
  context.setLineDash(border.style === 'dashed' ? [width * 2.5, width * 1.5] : border.style === 'dotted' ? [0.1, width * 1.8] : [])
  context.lineCap = border.style === 'dotted' ? 'round' : 'butt'
  const ring = (radius: number) => { context.beginPath(); context.arc(size / 2, size / 2, radius, 0, Math.PI * 2); context.stroke() }
  if (border.style === 'double') {
    ring(size / 2 - width / 6)
    ring(size / 2 - width + width / 6)
  } else ring(size / 2 - width / 2)
}

//the source picture as a JPEG data URL no larger than the backend keeps
function sourceDataUrl(image: HTMLImageElement): string {
  const scale = Math.min(1, maxSourceSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

interface TokenMakerProps {
  characterId?: string
  monsterId?: string                                                                                                    //save into the monster token pack instead of a character
  storedImage?: string                                                                                                  //last source picture, for re-cropping
  currentAvatar?: string
}

export default function TokenMaker({characterId, monsterId, storedImage, currentAvatar}: TokenMakerProps) {
  const [source, setSource] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [circle, setCircle] = useState<Circle>({x: 0, y: 0, radius: 0})
  const [border, setBorder] = useState<{ width: number; color: string; style: BorderStyle }>({width: 6, color: '#003c77', style: 'solid'})
  const [dropping, setDropping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ pointerX: number; pointerY: number; circle: Circle } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  //load a picture; the circle starts centered, as large as fits
  useEffect(() => {
    if (!source) { setImage(null); return }
    const loading = new Image()
    loading.onload = () => {
      setImage(loading)
      setCircle({x: loading.naturalWidth / 2, y: loading.naturalHeight / 2, radius: Math.min(loading.naturalWidth, loading.naturalHeight) * 0.4})
    }
    loading.onerror = () => setError('Не удалось открыть изображение')
    loading.src = source
  }, [source])

  //keep the whole circle on the picture
  const clamp = useCallback((next: Circle): Circle => {
    if (!image) return next
    const radius = Math.max(8, Math.min(next.radius, image.naturalWidth / 2, image.naturalHeight / 2))
    return {
      radius,
      x: Math.min(image.naturalWidth - radius, Math.max(radius, next.x)),
      y: Math.min(image.naturalHeight - radius, Math.max(radius, next.y))
    }
  }, [image])

  useEffect(() => {
    if (image && preview.current) drawToken(preview.current, image, circle, border)
  }, [image, circle, border])

  const pickFile = (file: File | undefined) => {
    setError(null)
    setSaved(false)
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Нужен файл изображения')
    if (file.size > maxFileBytes) return setError('Файл больше 15 МБ')
    const reader = new FileReader()
    reader.onload = () => setSource(String(reader.result))
    reader.readAsDataURL(file)
  }

  //screen pixels → source pixels for the picture as displayed
  const pixelScale = () => {
    const rect = stage.current?.getBoundingClientRect()
    return rect && image ? image.naturalWidth / rect.width : 1
  }

  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {pointerX: event.clientX, pointerY: event.clientY, circle}
  }
  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    const scale = pixelScale()
    setCircle(clamp({...start.circle, x: start.circle.x + (event.clientX - start.pointerX) * scale, y: start.circle.y + (event.clientY - start.pointerY) * scale}))
  }

  //wheel resizes the circle; a native listener, since React's wheel handler cannot stop the page from scrolling
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const wheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      setCircle((current) => clamp({...current, radius: current.radius * Math.exp(-event.deltaY * 0.001)}))
    }
    element.addEventListener('wheel', wheel, {passive: false})
    return () => element.removeEventListener('wheel', wheel)
  }, [image, clamp])

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDropping(false)
    pickFile(event.dataTransfer.files[0])
  }

  const save = async () => {
    if (!image) return
    setPending(true)
    setError(null)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = tokenSize
    drawToken(canvas, image, circle, border)
    try {
      const avatar = canvas.toDataURL('image/png')
      const freshSource = source?.startsWith('data:') ? sourceDataUrl(image) : undefined
      const result = monsterId ? await saveMonsterToken(monsterId, avatar, freshSource)
        : characterId ? await updateProfile(characterId, {avatar, ...(freshSource ? {image: freshSource} : {})})
        : {isSuccess: false, message: 'Некуда сохранить'}
      if (!result.isSuccess) setError(result.message)
      else { setSaved(true); router.refresh() }
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Не удалось сохранить')                                         //a tainted canvas (foreign picture) cannot be exported
    } finally {
      setPending(false)
    }
  }

  if (!image) {
    return (
      <div className="small">
        <div className={`border border-2 rounded p-4 text-center ${dropping ? 'border-primary bg-primary-subtle' : 'border-secondary'}`} role="button" tabIndex={0}
             onClick={() => fileInput.current?.click()} onKeyDown={(event) => event.key === 'Enter' && fileInput.current?.click()}
             onDragOver={(event) => { event.preventDefault(); setDropping(true) }} onDragLeave={() => setDropping(false)} onDrop={onDrop}>
          {currentAvatar && <img src={currentAvatar} alt="" width={64} height={64} className="rounded-circle object-fit-cover mb-2"/>}
          <div>Перетащите картинку сюда или нажмите, чтобы выбрать</div>
          <div className="text-muted">Из неё вырежем круглый токен для карты и листа</div>
        </div>
        <input ref={fileInput} type="file" accept="image/*" className="d-none" onChange={(event: ChangeEvent<HTMLInputElement>) => pickFile(event.target.files?.[0])}/>
        {storedImage && <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setSource(storedImage)}>Перекроить из сохранённой картинки</button>}
        {error && <div className="text-danger mt-1">{error}</div>}
      </div>
    )
  }

  const shown = 100 / image.naturalWidth                                                                                //source px → % of the stage width
  return (
    <div className="row g-3 small">
      <div className="col-md-8">
        <div ref={stage} className="position-relative overflow-hidden rounded border user-select-none" style={{touchAction: 'none'}}>
          <img src={image.src} alt="" className="d-block w-100 h-auto" draggable={false}/>
          <svg className="position-absolute top-0 start-0 w-100 h-100 pe-none" viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`} preserveAspectRatio="none">
            <defs>
              <mask id={`token-mask-${characterId ?? monsterId}`}>
                <rect width="100%" height="100%" fill="white"/>
                <circle cx={circle.x} cy={circle.y} r={circle.radius} fill="black"/>
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,.55)" mask={`url(#token-mask-${characterId ?? monsterId})`}/>
            <circle cx={circle.x} cy={circle.y} r={circle.radius} fill="none" stroke="white" strokeWidth={Math.max(2, image.naturalWidth / 300)} strokeDasharray="8 6"/>
          </svg>
          <div className="position-absolute rounded-circle" style={{
            left: `${(circle.x - circle.radius) * shown}%`, top: `${(circle.y - circle.radius) * 100 / image.naturalHeight}%`,
            width: `${circle.radius * 2 * shown}%`, height: `${circle.radius * 2 * 100 / image.naturalHeight}%`, cursor: 'move'
          }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}/>
        </div>
        <div className="text-muted mt-1">Тащите круг; колесо мыши или ползунок — размер.</div>
      </div>
      <div className="col-md-4 d-flex flex-column gap-2">
        <div className="text-center"><canvas ref={preview} width={128} height={128} className="rounded-circle" style={{background: 'repeating-conic-gradient(#444 0 25%, #333 0 50%) 0 0 / 16px 16px'}}/></div>
        <label className="w-100">Размер
          <input type="range" className="form-range" min={8} max={Math.min(image.naturalWidth, image.naturalHeight) / 2} step={1} value={circle.radius}
                 onChange={(event) => setCircle(clamp({...circle, radius: Number(event.target.value)}))}/>
        </label>
        <label className="w-100">Рамка
          <select className="form-select form-select-sm" value={border.style} onChange={(event) => setBorder({...border, style: event.target.value as BorderStyle})}>
            {borderStyles.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
          </select>
        </label>
        {border.style !== 'none' && (
          <div className="d-flex align-items-center gap-2">
            <input type="color" className="form-control form-control-sm form-control-color" value={border.color} onChange={(event) => setBorder({...border, color: event.target.value})} aria-label="Цвет рамки"/>
            <input type="range" className="form-range" min={1} max={20} value={border.width} onChange={(event) => setBorder({...border, width: Number(event.target.value)})} aria-label="Толщина рамки"/>
          </div>
        )}
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={() => void save()}>{pending ? <Spinner/> : 'Сохранить токен'}</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pending} onClick={() => { setSource(null); setSaved(false) }}>Другая картинка</button>
        </div>
        {saved && <span className="text-success">Токен сохранён</span>}
        {error && <span className="text-danger">{error}</span>}
      </div>
    </div>
  )
}
