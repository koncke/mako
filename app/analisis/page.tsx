// =============================================================================
// /analisis → /dashboard  (la tab se mudó a Experiments el 11/10/2026, y Experiments se retiró el 17/10/2026)
// =============================================================================
// El informe de Análisis (la cascada de costos, la fuga de los que no calificaban, los creativos y la meta) vivía como la
// cuarta pestaña de Experiments. Martín, 17/10/2026, sobre Experiments: «no tengas miedo de eliminar completamente lo que
// está hecho y sólo conservar lo que pretende la tab». Esas preguntas las contestan las hojas del Dashboard (Marketing,
// Comercial) y su AI Analyst; `lib/analisis-negocio.ts` sigue vivo para MaKo (sus herramientas, la API, Offer).
//
// ⚠️ SE REDIRIGE, NO SE BORRA: /analisis está en marcadores, links compartidos y tareas del plan (AGENTS.md, «Retirar una
// RUTA»). El rango del link viejo (`?desde=…&hasta=…`) ya no tiene a dónde ir: el Dashboard tiene su propio período.
// Con `rutaConWs`, por la pestaña del cliente que el super admin está mirando.
//
// /analisis/trimestre NO se va: el informe congelado tiene su propia ruta y su link ya salió por WhatsApp.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function AnalisisMudada() {
  redirect(await rutaConWs('/dashboard'));
}
