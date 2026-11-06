'use client'

// MaKo (no está en Polar): ¿ya estamos en el navegador? Lo que se cuenta con un rango de fechas (el crecimiento, los que más
// pagaron) usa el reloj y la zona del navegador, como Polar; en el server saldría otra cosa y la hidratación no coincidiría.
// Hasta entonces se dibuja lo de «cargando» de Polar. Sin un `useEffect` que cambie estado: `useSyncExternalStore` da
// `false` en el server y en la hidratación, y `true` después.

import { useSyncExternalStore } from 'react'

const sinSuscripcion = () => () => {}

export const useEnElNavegador = () =>
  useSyncExternalStore(sinSuscripcion, () => true, () => false)
