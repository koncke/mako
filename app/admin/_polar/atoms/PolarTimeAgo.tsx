'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/PolarTimeAgo.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// ⚠️ Polar lo arma con `react-timeago`, que MaKo no tiene: el mismo formato («just now», «3 days ago») sale de
//    Intl.RelativeTimeFormat en español, y se refresca cada minuto como el de ellos.

import { useEffect, useState } from 'react'

const UNIDADES: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
]

export function haceCuanto(date: Date, ahora: number = Date.now()): string {
  const seg = Math.round((date.getTime() - ahora) / 1000)
  if (Math.abs(seg) < 60) return 'recién'
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  for (const [u, s] of UNIDADES) if (Math.abs(seg) >= s) return rtf.format(Math.round(seg / s), u)
  return 'recién'
}

const PolarTimeAgo = (props: { date: Date; suffix?: string }) => {
  const [ahora, setAhora] = useState<number | null>(null)
  useEffect(() => {
    setAhora(Date.now())
    const t = setInterval(() => setAhora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  // Antes de montar se escribe la fecha (el server y el navegador no tienen el mismo «ahora»).
  return <time dateTime={props.date.toISOString()}>{ahora == null ? props.date.toLocaleDateString('es') : haceCuanto(props.date, ahora)}</time>
}

export default PolarTimeAgo
