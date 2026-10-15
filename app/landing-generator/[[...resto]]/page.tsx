// =============================================================================
// /landing-generator[/…] → /web-generator[/…]  (la tab se renombró el 15/10/2026)
// =============================================================================
// Pedido de Martín (feedback de la tanda 6, punto 1), textual: «Quiero que todo se llame ahora
// "Web Generator", la ruta, en la sidebar, todo...» La pantalla vive en app/web-generator.
//
// ⚠️ SE REDIRIGE, NO SE BORRA: /landing-generator está escrito en lugares que nadie puede editar —
// el link del editor que MaKo ya mandó por chat (`/landing-generator/<id>?ws=N`, `linkEditor` de
// la API de MaKo), avisos, marcadores, tareas del plan—. Un 404 ahí es peor que la pantalla vieja
// (AGENTS.md, «Retirar una RUTA»). Es UNA página para todo lo de abajo (el Panel, `/<id>`,
// `/crear`, `/analizar` y lo que hubiera): un catch-all opcional, así ningún camino viejo queda
// sin destino.
//
// ⚠️ CON EL CAMINO Y LA QUERY ENTERA, y DIRECTO: `/landing-generator/12?ws=3` va a
// `/web-generator/12?ws=3`, no al Panel. El `?diagnostico=`/`?url=`/`?paso=` es lo que abre la
// cosa que el link nombra (`destinoWebGenerator`, lib/ruta-web-generator.ts). Y con `rutaConWs`:
// un `redirect()` pelado pierde la pestaña del cliente que el super admin está mirando — si el link
// ya trae su `?ws=`, `conWs` lo respeta tal cual.
//
// Sin guard de rol a propósito: un redirect no muestra nada, y /web-generator hace su propio
// `requireRolWs([], { nav: 'landing-writer' })`.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { destinoWebGenerator } from '@/lib/ruta-web-generator';

export default async function LandingGeneratorRenombrada({ params, searchParams }: {
  params: Promise<{ resto?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resto } = await params;
  redirect(await rutaConWs(destinoWebGenerator(resto, await searchParams)));
}
