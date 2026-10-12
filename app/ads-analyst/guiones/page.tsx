// =============================================================================
// /ads-analyst/guiones — ahora es la tabla «Guiones» de la hoja «Ads Analyst» del Dashboard
// =============================================================================
// Era el «Ver todos» de la tab Ads Analyst, que se retiró el 11/10/2026 (el porqué y adónde fue cada
// cosa, en app/ads-analyst/page.tsx). La lista completa de guiones con sus métricas es un componente de
// la hoja (lib/graficos-plantillas-analysts.ts, «Guiones»), así que el link viejo va a la hoja.
//
// SE REDIRIGE, NO SE BORRA: /script-analyst/guiones también llega acá por next.config.ts. Con `rutaConWs`.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=ads-analyst'));
}
