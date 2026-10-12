// =============================================================================
// /landing-generator/analizar — el diagnóstico de una landing, dentro de Landing Generator
// =============================================================================
// Decisión de Martín (11/10/2026): «Lo de Landing Analyst se muda a Landing Generator y
// Landing Analyst se ELIMINA (la ruta redirige)». Lo que se mudó es la TAREA: pegar una URL
// y analizarla, «Buscar mis páginas», pegar el texto cuando la página se arma en el
// navegador, reintentar / volver a analizar / quitar, leer el diagnóstico y «Escribir la
// nueva versión». Lo que era ANÁLISIS (el pulso del Pixel, el mapa de calor, los KPIs) ya
// vive en la hoja «Landing» del Dashboard. /landing-analyst redirige acá conservando la
// query (app/landing-analyst/destino.ts).
//
// MaKo baja la landing del cliente, le lee el copy y lo cruza con el comportamiento real de
// esa misma URL (visitas y retención del Pixel, agendas del CRM). La data vive en
// landing_analyses (la llenan /api/landing-analyst/{analyze,sync} y el análisis automático de
// las declaradas); esta página solo lee. No se gatea por integración: con pegar una URL
// alcanza para tener el diagnóstico del copy, y cuando falta el Pixel el bloque que lo
// necesita lo dice adentro.
//
// ⚠️ CARPETA ESTÁTICA A PROPÓSITO: la sesión del editor de landings crea `[id]/` al lado, y un
// segmento estático gana sobre el dinámico, así que `analizar` nunca se lee como un id. Y el
// componente NO se mudó: se importa de app/landing-analyst/ (esa sesión toca su link de
// «Escribir la nueva versión»; mudarlo partiría el trabajo de las dos en dos archivos).
//
// La puerta es la de la tab que la contiene: admin del workspace + `landing-writer` en su capa
// (la key del nav de Landing Generator). La key 'landing-an' se queda gobernando el onboarding
// del diagnóstico y el gating de la API de MaKo: está escrita en la base. Página privada y sin
// Suspense: el componente no lee la query.

import { getLandingViewData, type LandingViewData } from '@/lib/landing-analyst';
import { LandingAnalystApp } from '@/app/landing-analyst/LandingAnalystApp';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VACIO: LandingViewData = {
  landings: [],
  sinAnalizar: [],
  kpis: { total: 0, conError: 0, scorePromedio: null, hallazgosAltos: 0 },
  lastSync: null,
};

export default async function DiagnosticoLandingPage() {
  await requireRolWs([], { nav: 'landing-writer' });

  // Una lectura que falla no es «no analizaste ninguna página»: la pantalla dibuja el error
  // arriba (errorMsg) y deja la caja de analizar a mano, que no depende de esta lectura.
  let data: LandingViewData = VACIO;
  let errorMsg: string | null = null;
  try {
    data = await getLandingViewData();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return <LandingAnalystApp data={data} errorMsg={errorMsg} />;
}
