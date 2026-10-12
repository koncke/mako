// =============================================================================
// /ads-analyst — ahora es la hoja «Ads Analyst» del Dashboard
// =============================================================================
// Decisión de Martín (11/10/2026): lo de Ads Analyst se muda y la tab se ELIMINA. Lo que era ANÁLISIS
// (los cuatro números, los patrones, el cuadrante de retención, la tabla de guiones) vive en la plantilla
// «Ads Analyst» del Dashboard (lib/graficos-plantillas-analysts.ts); lo que EJECUTABA una tarea (valorar
// un guion nuevo, sincronizar, ángulos y avatares) vive en Ads Writer → «Analizar guion»
// (/ads-writer?tab=analizar, app/ads-writer/AnalizarGuion.tsx).
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen marcadores, avisos y mensajes
// viejos, y /script-analyst llega acá por next.config.ts. El destino es el análisis porque es lo que
// esta pantalla mostraba al abrirse. Va con `rutaConWs`, o el super admin mirando a un cliente terminaría
// en su propio Dashboard. Molde: app/productivity-analyst/page.tsx.
//
// ScriptsBrowser.tsx se QUEDA en esta carpeta: lo importa app/marketing/ad-charts.tsx (la ficha de un
// anuncio del Ads Manager).

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=ads-analyst'));
}
