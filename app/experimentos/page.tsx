// =============================================================================
// /experimentos — se retiró: los experimentos viven en el Dashboard, en «Editar con MaKo»
// =============================================================================
// Martín, 17/10/2026: «Quiero que "Experiments" la simplifiques completamente: la funcionalidad, o lo que pretendía,
// puede vivir dentro del chat de MaKo de "Dashboard". OJO, no tengas miedo de eliminar completamente lo que está hecho y
// sólo conservar lo que pretende la tab». Lo que pretendía —probar una hipótesis contra el dato real y quedarse con lo que
// el dato confirma— es «probemos X» en «Editar con MaKo»: la hoja muestra el experimento, se arranca, se mide y se
// concluye ahí (app/dashboard/ElementoExperimento.tsx, lib/experimentos-catalogo.ts). Las cuatro pestañas de esta tab
// (Retro, Experiments, Conclusions y Análisis) se fueron con ella.
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): el link salió por WhatsApp (MaKo lo daba como el lugar de
// las verdades validadas) y desde el «Probarlo» de Offer con la hipótesis escrita. Ésa viaja: `?hipotesis=` llega como
// `?probar=`, que abre «Editar con MaKo» con «Probemos: …» (`destinoDeExperimentos`). Con `rutaConWs`, o el super admin
// mirando a un cliente terminaría en su propio Dashboard.
//
// ⚠️ LA PUERTA DE LA TAB QUE SE FUE se queda mientras su key `experimentos` siga en la barra (el chat «Sidebar» la dejó
// como ítem sin fila y sección oculta del teléfono; tests/movil-mas-secciones.test.ts exige la misma puerta en las dos
// páginas): quien no veía Experiments sigue rebotando como antes, y el resto lo vuelve a mirar /dashboard. Cuando la key
// se vaya, esta línea se va con ella.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { requireRolWs } from '@/lib/tab-access';
import { destinoDeExperimentos } from '@/lib/experimentos-catalogo';

export default async function ExperimentosRetirada({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'experimentos' });
  redirect(await rutaConWs(destinoDeExperimentos(await searchParams)));
}
