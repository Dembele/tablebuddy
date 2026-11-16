'use client'
//The current map: loads its image, stacks background / tokens / fog / marks / gestures inside the pan-zoom viewport.
import {useEffect, useState} from "react"
import {useRoomStore} from "@frontend/store/room"
import PanZoom from "@frontend/components/Game/Canvas/PanZoom"
import GestureLayer from "@frontend/components/Game/Canvas/GestureLayer"
import {BackgroundLayer, FogLayer, MarksLayer, PingLayer, TokensLayer} from "@frontend/components/Game/Canvas/Layers"

export default function MapCanvas() {
  const map = useRoomStore((state) => state.map)
  const connected = useRoomStore((state) => state.connected)
  const setSelected = useRoomStore((state) => state.setSelected)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const source = map?.backgroundImagePath

  useEffect(() => {
    setImage(null)
    setFailed(false)
    if (!source) return
    const loading = new Image()
    loading.onload = () => setImage(loading)
    loading.onerror = () => setFailed(true)
    loading.src = source
    return () => { loading.onload = null; loading.onerror = null }
  }, [source])

  if (!map) {
    return (
      <div className="room__placeholder">
        {connected ? 'Карта не выбрана — ГМ выбирает её в кампании или здесь, в меню карт.' : <><span className="spinner-border spinner-border-sm"/>Подключение к комнате…</>}
      </div>
    )
  }
  if (failed) return <div className="room__placeholder text-danger">Не удалось загрузить изображение карты</div>
  if (!image) return <div className="room__placeholder"><span className="spinner-border spinner-border-sm"/>Загрузка карты…</div>

  const {width, height} = image
  return (
    <PanZoom width={width} height={height} onTap={() => setSelected([])}>
      <BackgroundLayer map={map} image={image}/>
      <TokensLayer map={map}/>
      <FogLayer map={map} width={width} height={height}/>
      <MarksLayer map={map} width={width} height={height}/>
      <PingLayer map={map}/>
      <GestureLayer map={map} width={width} height={height}/>
    </PanZoom>
  )
}
