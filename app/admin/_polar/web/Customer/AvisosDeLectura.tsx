'use client'

// MaKo (no está en Polar): una lectura que salió A MEDIAS. Las de MaKo (lib/clientes-plataforma.ts, lib/admin-ingresos.ts)
// devuelven lo que pudieron y en `avisos` lo que no; sin esto, una lista corta se lee como completa. Va arriba de la lista,
// con el Alert de Polar.
// ⚠️ ES EL AVISO DE LECTURA INCOMPLETA DE ADMIN, con UN título, «Puede faltar algo» (revisión del Cerebro del 6/11/2026,
//    punto 42: el mismo aviso tenía al menos seis títulos). Lo usan Customers y Overview (lo que espera arriba de los widgets).
//    Cada aviso nombra lo que no se leyó («los cobros de la pasarela: …»): acá se juntan sin repetir y sin el punto final de
//    cada uno, que el renglón ya cierra.

import { Alert } from '@/app/admin/_polar/orbit'

/** Los avisos como se dicen: sin repetir y sin el punto final de cada uno. */
export const avisosSinRepetir = (avisos: readonly string[]): string[] =>
  [...new Set(avisos.map((a) => a.trim().replace(/[.\s]+$/, '')).filter(Boolean))]

export const AvisosDeLectura = ({ avisos }: { avisos?: readonly string[] }) => {
  const lista = avisosSinRepetir(avisos ?? [])
  return lista.length > 0 ? (
    <Alert
      variant="warning"
      soporte
      title="Puede faltar algo"
      description={`No pude leer ${lista.join('; ')}.`}
    />
  ) : null
}
