'use client'
//Map create / edit form (DM): name, image (data URL), fog switch; grid alignment with a live CSS overlay preview. Without a campaign it
//creates / edits a library map.
//Grid size (cells) follows from the image size, cell size and offsets — the same rule the canvas draws by.
//Aligning the grid is the job when a map is created, so that fold starts open; on an edit it is closed behind its digest.
//The preview is the game room's pan / zoom viewport over the image at its real size: wheel or pinch goes in to single pixels
//(grid lines stay one screen pixel until one image pixel is bigger than that), drag moves, the corner button shows the whole map again.
import {ChangeEvent, useEffect, useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import type {IMap} from "@frontend/deps/interfaces/DB/Map"
import {createLibraryMap, createMap, MapInput, updateMap} from "@frontend/actions/maps"
import Spinner from "@frontend/components/UI/Spinner"
import Fold from "@frontend/components/UI/Fold"
import PanZoom from "@frontend/components/Game/Canvas/PanZoom"

const maxImageBytes = 7 * 1024 * 1024                                                                                   //server actions accept 10mb, base64 adds a third

type Grid = IMap['gridConfig']

export const defaultGrid: Grid = {
  size: {x: 20, y: 20}, color: '#000000', offset: {top: 0, bottom: 0, right: 0, left: 0}, cellSize: {x: 50, y: 50}, feats: 5, opacity: 0.8
}

interface MapFormProps {
  campaignId?: string                                                                                                   //absent = a library map
  id?: string                                                                                                           //absent = create
  initial?: Pick<IMap, 'name' | 'description' | 'gridType' | 'gridConfig' | 'backgroundImagePath'> & { fogEnabled: boolean }
}

//whole cells that fit between the left/top offsets and the right/bottom ones
function cellsFor(grid: Grid, width: number, height: number): Grid['size'] {
  const {offset, cellSize} = grid
  return {
    x: Math.max(1, Math.floor((width - offset.left - offset.right) / Math.max(1, cellSize.x))),
    y: Math.max(1, Math.floor((height - offset.top - offset.bottom) / Math.max(1, cellSize.y)))
  }
}

function NumberField({label, value, onChange, step = 1, min}: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number }) {
  return (
    <label className="form-label small w-100 mb-0">{label}
      <input type="number" inputMode="decimal" className="form-control form-control-sm" value={value} step={step} min={min}
             onChange={(event) => onChange(Number(event.target.value) || 0)}/>
    </label>
  )
}

export default function MapForm({campaignId, id, initial}: MapFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [gridType, setGridType] = useState<IMap['gridType']>(initial?.gridType ?? 'square')
  const [grid, setGrid] = useState<Grid>(initial?.gridConfig ?? defaultGrid)
  const [fogEnabled, setFogEnabled] = useState(initial?.fogEnabled ?? false)
  const [image, setImage] = useState<string | undefined>(undefined)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)                                                                                 //preview zoom: screen pixels per image pixel
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const preview = image ?? initial?.backgroundImagePath
  const size = natural ? cellsFor(grid, natural.width, natural.height) : grid.size

  //the picture's real size: the preview draws in image pixels, and the cell count follows from it
  useEffect(() => {
    setNatural(null)
    if (!preview) return
    const loading = new Image()
    loading.onload = () => setNatural({width: loading.naturalWidth, height: loading.naturalHeight})
    loading.src = preview
    return () => { loading.onload = null }
  }, [preview])

  const patch = (changes: Partial<Grid>) => { setGrid((current) => ({...current, ...changes})); setNotice(null) }
  const patchOffset = (side: keyof Grid['offset'], value: number) => patch({offset: {...grid.offset, [side]: value}})
  const patchCell = (axis: 'x' | 'y', value: number) => patch({cellSize: {...grid.cellSize, [axis]: value}})

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > maxImageBytes) return setError('Изображение больше 7 МБ')
    setError(null)
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  const submit = () => startTransition(async () => {
    setError(null)
    setNotice(null)
    if (!id && !image) return setError('Выберите изображение карты')
    const input: MapInput = {name: name.trim(), description, gridType, gridConfig: {...grid, size}, fogEnabled, ...(image ? {image} : {})}
    if (id) {
      const {isSuccess, message} = await updateMap(id, campaignId, input)
      if (!isSuccess) return setError(message)
      setNotice('Сохранено')
      router.refresh()
    } else {
      const {data, message} = campaignId ? await createMap(campaignId, input) : await createLibraryMap(input)
      if (!data?._id) return setError(message)
      router.push(campaignId ? `/campaigns/${campaignId}` : '/maps')
    }
  })

  //overlay box and line pattern in image pixels; a line is one screen pixel wide until zoomed past 1:1, then exactly one image pixel
  const line = Math.max(1, 1 / scale)
  const overlay = natural && gridType === 'square' ? {
    left: grid.offset.left,
    top: grid.offset.top,
    width: size.x * grid.cellSize.x + line,
    height: size.y * grid.cellSize.y + line,
    opacity: grid.opacity ?? 0.8,
    backgroundImage: `linear-gradient(to right, ${grid.color} ${line}px, transparent ${line}px), linear-gradient(to bottom, ${grid.color} ${line}px, transparent ${line}px)`,
    backgroundSize: `${grid.cellSize.x}px ${grid.cellSize.y}px`
  } : null

  const gridDigest = gridType === 'none' ? 'без сетки' : `клетка ${grid.cellSize.x}×${grid.cellSize.y} px · ${size.x}×${size.y} клеток · ${grid.feats} фт.`

  return (
    <div className="row g-3">
      <div className="col-md-5 col-lg-4 d-flex flex-column gap-2">
        <label className="form-label small w-100 mb-0">Название
          <input className="form-control form-control-sm" value={name} onChange={(event) => setName(event.target.value)}/>
        </label>
        <label className="form-label small w-100 mb-0">{id ? 'Заменить изображение' : 'Изображение'} <span className="text-muted">· до 7 МБ</span>
          <input type="file" accept="image/*" className="form-control form-control-sm" onChange={pickImage}/>
        </label>
        <div className="form-check small">
          <input id="fog-enabled" type="checkbox" className="form-check-input" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)}/>
          <label htmlFor="fog-enabled" className="form-check-label">Туман войны <span className="text-muted">· ГМ открывает клетки в игре</span></label>
        </div>

        <Fold title="Сетка" digest={gridDigest} open={!id}>
          <div className="tb-tabs mb-2">
            <button type="button" className={gridType === 'square' ? 'is-active' : ''} onClick={() => setGridType('square')}>Клетки</button>
            <button type="button" className={gridType === 'none' ? 'is-active' : ''} onClick={() => setGridType('none')}>Без сетки</button>
          </div>
          {gridType === 'square' && (
            <>
              <div className="tb-eyebrow">Клетка, px</div>
              <div className="row g-2">
                <div className="col-6"><NumberField label="ширина" value={grid.cellSize.x} min={5} onChange={(value) => patchCell('x', value)}/></div>
                <div className="col-6"><NumberField label="высота" value={grid.cellSize.y} min={5} onChange={(value) => patchCell('y', value)}/></div>
              </div>
              <div className="tb-eyebrow mt-2">Отступы от краёв, px</div>
              <div className="row g-2">
                <div className="col-3"><NumberField label="слева" value={grid.offset.left} onChange={(value) => patchOffset('left', value)}/></div>
                <div className="col-3"><NumberField label="сверху" value={grid.offset.top} onChange={(value) => patchOffset('top', value)}/></div>
                <div className="col-3"><NumberField label="справа" value={grid.offset.right} onChange={(value) => patchOffset('right', value)}/></div>
                <div className="col-3"><NumberField label="снизу" value={grid.offset.bottom} onChange={(value) => patchOffset('bottom', value)}/></div>
              </div>
              <div className="tb-eyebrow mt-2">Масштаб и линии</div>
              <div className="row g-2 align-items-end">
                <div className="col-4"><NumberField label="футов" value={grid.feats} min={1} onChange={(value) => patch({feats: value})}/></div>
                <div className="col-4"><NumberField label="плотность" value={grid.opacity ?? 0.8} step={0.1} min={0} onChange={(value) => patch({opacity: Math.min(1, Math.max(0, value))})}/></div>
                <div className="col-4">
                  <label className="form-label small w-100 mb-0">цвет
                    <input type="color" className="form-control form-control-sm form-control-color w-100" value={grid.color} onChange={(event) => patch({color: event.target.value})}/>
                  </label>
                </div>
              </div>
              <div className="small text-muted mt-2">Получается клеток: {size.x} × {size.y}</div>
            </>
          )}
        </Fold>

        <Fold title="Описание" digest={description.trim() ? description.trim().split('\n')[0].slice(0, 60) : 'нет — заметка для себя'} open={false}>
          <textarea className="form-control form-control-sm" rows={3} value={description} aria-label="Описание карты" onChange={(event) => setDescription(event.target.value)}/>
        </Fold>

        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={pending || name.trim().length < 1} onClick={submit}>
            {pending ? <Spinner/> : id ? 'Сохранить карту' : 'Создать карту'}
          </button>
          {notice && <span className="small text-success">{notice}</span>}
          {error && <span className="small text-danger">{error}</span>}
        </div>
      </div>
      <div className="col-md-7 col-lg-8">
        <div className="sticky-top pt-1">
        {preview && natural ? (
          <div className="map-preview" style={{aspectRatio: `${natural.width} / ${natural.height}`}}>
            <PanZoom width={natural.width} height={natural.height} maxScale={24} fitShare={1} onScale={setScale}>
              <img src={preview} alt="" width={natural.width} height={natural.height} className="d-block" draggable={false} style={{imageRendering: scale > 3 ? 'pixelated' : undefined}}/>
              {overlay && <div className="position-absolute pe-none" style={overlay}/>}
            </PanZoom>
          </div>
        ) : preview ? (
          <div className="tb-empty border rounded"><span className="spinner-border spinner-border-sm me-2"/>Загрузка изображения…</div>
        ) : <div className="tb-empty border rounded">Выберите изображение — здесь появится карта с сеткой поверх.</div>}
        {natural && (
          <div className="small text-muted mt-1 d-flex flex-wrap justify-content-between gap-2">
            <span>Изображение: {natural.width} × {natural.height} px · масштаб {scale >= 1 ? `×${scale.toFixed(scale < 10 ? 1 : 0)}` : `${Math.round(scale * 100)}%`}</span>
            <span>Колесо или щипок — ближе, тянуть — сдвиг</span>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
