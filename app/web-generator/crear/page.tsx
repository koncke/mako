// =============================================================================
// /web-generator/crear — redirige al Panel con «Crear con IA» abierto a la derecha
// =============================================================================
// Pedido de Martín (14/10/2026, tanda 6, punto 2), textual: «La sección de "Importar con IA" no debería
// ser otra ruta, todo siempre en la misma ruta.» «Crear con IA» (crear/CrearConIA.tsx) se monta a la
// DERECHA del Panel (/web-generator, Inicio.tsx) y sus tarjetas viven en la caja «¿Qué vas a crear
// hoy?» (CajaCrear.tsx). Esta ruta pasa a REDIRIGIR ahí, con la query entera: `?paso=` y `?tipo=` abren
// ese paso, el deep link del Landing Analyst (`?url=`, `?objetivo=`) abre «Generar» con esa landing de
// base, y el link de la caja de una pestaña con la pantalla vieja (`?desde=caja&modo=…`) arranca su
// pedido. La traducción la hace `derechaDeQuery` (../panel-reglas.ts, puro y con test).
//
// ⚠️ SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la nombran el Landing Analyst
// (app/landing-analyst/LandingAnalystApp.tsx, con `?url=`) y cualquier link que alguien haya
// guardado. El `?ws=` del link viaja
// (`destinoCrear`), y `rutaConWs` le pone el de la pestaña si el link no traía uno: sin él, el super
// admin que mira a un cliente terminaría en su propia cuenta.
//
// La puerta es la de la tab del Panel (admin del workspace + `landing-writer` en su capa): el destino
// la vuelve a pedir, pero así un link de un setter no rebota dos veces.

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { destinoCrear } from '../panel-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CrearLandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  redirect(await rutaConWs(destinoCrear(await searchParams)));
}
