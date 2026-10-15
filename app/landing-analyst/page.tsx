// =============================================================================
// /landing-analyst → la tab se retiró el 11/10/2026 (redirige, no se borra)
// =============================================================================
// Decisión de Martín: «Lo de Landing Analyst se muda a Landing Generator y Landing Analyst
// se ELIMINA (la ruta redirige)». Lo que era ANÁLISIS (`?tab=pulso`, `?tab=mapa`) ya vivía
// en la hoja «Landing» del Dashboard; lo que era TAREA —el diagnóstico: analizar una URL,
// buscar mis páginas, pegar el texto, reintentar, quitar, «Escribir la nueva versión»— se
// mudó a /web-generator/analizar. La traducción de la pestaña vive en ./destino.ts, con
// su test (tests/landing-generator-analizar.test.ts).
//
// ⚠️ SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen avisos de WhatsApp ya
// mandados, marcadores, tareas del plan y el onboarding viejo. Va con `rutaConWs`: un
// `redirect()` pelado pierde la pestaña del cliente que el super admin está mirando.
//
// Sin guard de rol a propósito (molde: app/chatbot/page.tsx): un redirect no muestra nada, y
// las dos pantallas de destino hacen su propio `requireRolWs`. La key 'landing-an' NO se va:
// sigue en lib/capas.ts, en el onboarding y en el gating de la API (está escrita en la base).
//
// Los componentes de esta carpeta SE QUEDAN donde están: LandingAnalystApp.tsx lo monta
// /web-generator/analizar, y MapaDeCalor.tsx / PulsoPaginas.tsx los usa el Dashboard. Next
// sólo hace ruta de este page.tsx.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { destinoLandingAnalyst } from './destino';

export default async function LandingAnalystRetirada({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoLandingAnalyst(await searchParams)));
}
