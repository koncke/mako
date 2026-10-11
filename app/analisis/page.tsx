// =============================================================================
// /analisis → /experimentos?tab=analisis  (la tab se mudó el 11/10/2026)
// =============================================================================
// Pedido de Martín, textual: «Elimina la tab de "Análisis", llévala dentro de "Experiments"». El
// informe (la cascada de costos, la fuga de los que no calificaban, los creativos y la meta) vive
// ahora como la cuarta tab de Experiments: app/experimentos/VistaAnalisis.tsx, calculado en
// app/experimentos/page.tsx SÓLO cuando esa tab está abierta (analisisNegocio es lenta).
//
// ⚠️ SE REDIRIGE, NO SE BORRA: /analisis está escrito en lugares que nadie puede editar —
// marcadores, links compartidos con su rango (`?desde=…&hasta=…`, que el informe pone en la URL
// justamente para que se pueda citar), tareas del plan— y un 404 ahí es peor que la pantalla vieja
// (AGENTS.md, «Retirar una RUTA»).
//
// ⚠️ CON LA QUERY ENTERA, y `tab` AL FINAL del objeto: desde/hasta/cierres/presupuesto son lo que
// hace que el link abra EL MISMO análisis que se compartió; y un `?tab=` que viniera en el link
// viejo (basura: /analisis nunca tuvo tabs) no puede pisar el destino. Con `rutaConWs`, porque un
// `redirect()` pelado pierde la pestaña del cliente que el super admin está mirando; si el link ya
// trae su `?ws=`, viaja adentro de la query y `conWs` lo respeta.
//
// /analisis/trimestre NO se mudó: el informe congelado tiene su propia ruta, fijada por
// tests/informe-congelado.test.ts, y ese link ya salió por WhatsApp.
//
// Sin guard de rol a propósito: un redirect no muestra nada, y /experimentos hace su propio
// `requireRolWs([], { nav: 'experimentos' })` (que en las cuatro capas da lo mismo que 'analisis').

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { destinoConQuery } from '@/lib/ruta-automations';

export default async function AnalisisMudada({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery('/experimentos', { ...(await searchParams), tab: 'analisis' })));
}
