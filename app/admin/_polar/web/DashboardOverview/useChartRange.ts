'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/hooks/useChartRange.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el rango del gráfico de Overview y las métricas elegidas se recuerdan en el navegador, como el rango en Polar (su
// `useLocalStorage`). Polar guarda las métricas en la organización; Admin es la plataforma y sólo la mira el super admin,
// así que también van acá. Es una PREFERENCIA: arranca en el default (lo mismo en el server y en el navegador, sin un
// salto de hidratación) y se lee al montar. Toda lectura y escritura va en un try: en una ventana privada puede tirar.

import { useCallback, useEffect, useState } from 'react'

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento, el cambio vale mientras la pestaña siga abierta.
  }
}

/** Un valor recordado en el navegador. `validar` (memorizada por quien llama) devuelve el valor bueno o `null` (lo guardado ya no vale). */
export function useRecordado<T>(clave: string, porDefecto: T, validar: (crudo: string) => T | null, serializar: (v: T) => string) {
  const [valor, setValor] = useState<T>(porDefecto)
  useEffect(() => {
    const crudo = leer(clave)
    const bueno = crudo == null ? null : validar(crudo)
    if (bueno != null) setValor(bueno)
  }, [clave, validar])
  const cambiar = useCallback(
    (v: T) => {
      setValor(v)
      escribir(clave, serializar(v))
    },
    [clave, serializar],
  )
  return [valor, cambiar] as const
}

const storageKey = 'mako.admin.overview.rango'

/** El rango del gráfico de Overview, entre los que MaKo puede contestar (`disponibles`). */
export const useChartRange = <R extends string>(disponibles: readonly R[], porDefecto: R) => {
  const validos = disponibles.join('|')
  const validar = useCallback((crudo: string): R | null => (validos.split('|').includes(crudo) ? (crudo as R) : null), [validos])
  const serializar = useCallback((v: R) => v, [])
  const [range, setRange] = useRecordado<R>(storageKey, porDefecto, validar, serializar)
  // Si lo recordado dejó de estar disponible (p. ej. «Todo» cuando el primer pago quedó fuera de los meses leídos).
  return { range: disponibles.includes(range) ? range : porDefecto, setRange }
}
