import { useState } from 'react'
import { Footprints, MapPinned, Siren, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

interface Slide {
  icon: ReactNode
  title: string
  text: string
}

const SLIDES: Slide[] = [
  {
    icon: <Footprints size={56} />,
    title: 'Camina, no conduzcas',
    text: 'El juego se juega a pie. Si vas a más de 25 km/h se bloquea el comercio. Mira por dónde andas y no entres en sitios peligrosos o privados.',
  },
  {
    icon: <MapPinned size={56} />,
    title: 'Tu ciudad es el tablero',
    text: 'Compra materia prima en polígonos y farmacias, vende en parques y bares, y monta tu Cuartel General. Necesitamos tu ubicación mientras juegas.',
  },
  {
    icon: <Siren size={56} />,
    title: 'Cuidado con la poli',
    text: 'Cerca de las comisarías sube tu Búsqueda. Si llega al máximo, te quitan la mercancía que lleves encima. Lo guardado en el HQ está a salvo.',
  },
  {
    icon: <TriangleAlert size={56} />,
    title: 'Todo es ficticio',
    text: 'Es una sátira: los productos, nombres y negocios son inventados y no tienen nada que ver con sustancias reales. Los lugares salen de OpenStreetMap.',
  },
]

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="flex flex-col items-center gap-5 max-w-sm">
      <div className="cartoon-card p-5 flex flex-col items-center gap-3 text-center">
        {slide.icon}
        <p className="text-2xl font-black leading-tight">{slide.title}</p>
        <p className="font-bold text-sm">{slide.text}</p>
      </div>
      <div className="flex gap-2" aria-hidden>
        {SLIDES.map((_, n) => (
          <span key={n} className={`w-3 h-3 rounded-full border-2 border-black ${n === i ? 'bg-black' : 'bg-white'}`} />
        ))}
      </div>
      <button className="cartoon-btn px-8 py-3 text-lg" onClick={() => (last ? onDone() : setI(i + 1))}>
        {last ? '¡A la calle!' : 'Siguiente'}
      </button>
    </div>
  )
}
