// =============================================================================
// /landing-generator/analizar — redirige al Panel con el Diagnóstico abierto a la derecha
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 2), textual: «"Diagnóstico" no debería ser otra
// ruta, debería abrirse ahí a la derecha.» Decisión T2 de docs/diseno-editor-landing.md: el
// Diagnóstico de una landing se dibuja en el área principal del Panel (/landing-generator, que
// monta diagnostico/PanelDiagnostico.tsx), y esta ruta pasa a REDIRIGIR ahí.
//
// ⚠️ SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la nombran el onboarding de
// 'landing-an' (lib/tab-onboarding-catalogo.ts, escrito en la base), lib/mako-capacidades.ts,
// «Analizar una página» de Crear, /admin/dev, y los links viejos de /landing-analyst, que ya
// redirigen acá (app/landing-analyst/destino.ts, RUTA_DIAGNOSTICO). La traducción de la query
// (`?diagnostico=<id>` o `?id=` → una landing nuestra; `?url=` o `?analizar=` → una de afuera;
// sin ninguna → el Diagnóstico vacío para pegar una URL; el `?ws=` del link viaja) vive en
// `destinoAnalizar` (../panel-reglas.ts, puro y con test), y `rutaConWs` le pone el `?ws=` de la
// pestaña si el link no traía uno.
//
// ⚠️ CARPETA ESTÁTICA A PROPÓSITO: al lado está `[id]/`, y un segmento estático gana sobre el
// dinámico, así que `analizar` nunca se lee como el id de una landing.
//
// La puerta es la de la tab del Panel (admin del workspace + `landing-writer` en su capa): el
// destino la vuelve a pedir, pero así un link de un setter no rebota dos veces.

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { destinoAnalizar } from '../panel-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DiagnosticoLandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  redirect(await rutaConWs(destinoAnalizar(await searchParams)));
}
