'use client'

// Los avisos de Admin › Sales que no son de Polar: lo que no se pudo leer (la página se dibuja igual con lo que sí) y el error
// de una acción. Todo aviso de error lleva «Reportar a Soporte» (AGENTS.md) como su último hijo.

import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'

const caja = 'flex flex-col items-start gap-2 rounded-2xl border p-4 text-sm'

/** «No pude leer…»: la lista de lo que faltó. No es un vacío: lo que se ve puede quedarse corto. */
export function AvisosDeLectura({ avisos }: { avisos: readonly string[] }) {
  if (!avisos.length) return null
  return (
    <div role="alert" className={`${caja} border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300`}>
      <p>No pude leer todo, así que lo que ves puede quedarse corto:</p>
      <ul className="list-disc pl-5">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <ReportarASoporte />
    </div>
  )
}

/** El error de una acción (devolver, reenviar, cortar…), con su motivo. */
export function AvisoDeError({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <div role="alert" className={`${caja} border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400`}>
      <p>{texto}</p>
      <ReportarASoporte />
    </div>
  )
}

/** Lo que salió bien de una acción, en una línea. */
export function AvisoHecho({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <div role="status" className={`${caja} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400`}>
      <p>{texto}</p>
    </div>
  )
}
