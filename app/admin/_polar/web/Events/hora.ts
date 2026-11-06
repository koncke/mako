// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventLogRow.tsx
// (`formatEventTimestamp`). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: UN formato, en una línea. Con `toLocaleString('es-AR', …)` salían dos: «06-nov, 14:20:00» para lo que tiene hora y
// «04 de nov de 2026» (cortado en la celda) para un pago, que sólo tiene su día (6/11/2026). Acá se arma a mano con las partes del
// día: «06 nov, 14:20», y un pago «04 nov» (la misma fecha, sin la hora que no tiene; su día va en UTC, como se guardó). Sin los
// segundos (revisión del 6/11/2026): casi todo lo de MaKo se anota al minuto y la columna se llenaba de «:00»; la fila de Polar
// (EventRow, sin desplegar) tampoco los muestra. Puro: lo prueban tests/admin-polar-arreglos-2.test.ts y -arreglos-3.

export function horaDelEvento(timestamp: string, soloDia = false, timeZone?: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  const partes = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: soloDia ? 'UTC' : timeZone,
  }).formatToParts(d)
  const parte = (t: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === t)?.value ?? ''
  const dia = `${parte('day')} ${parte('month').replace(/\.$/, '')}`
  return soloDia ? dia : `${dia}, ${parte('hour')}:${parte('minute')}`
}
