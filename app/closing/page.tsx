// =============================================================================
// /closing — ahora es la hoja «Closing» del Dashboard
// =============================================================================
// Decisión 6 de Martín (11/10/2026): «Closing Analyst va COMPLETO al Dashboard… y la tab se ELIMINA (la
// ruta redirige). Los closers ven SÓLO la hoja Closing del Dashboard». Lo que era análisis vive en la
// plantilla «Closing» (lib/graficos-plantillas-analysts.ts) y el detalle de una llamada con sus tareas
// (re-analizar, revisar, re-evaluar con MaKo) en app/dashboard/bloques/extra/FichaLlamada.tsx.
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): `/closing?call=<id>` salió en mensajes de
// MaKo por WhatsApp (lib/mako-doer-in.ts lo enseñaba como deep link) y nadie los puede editar. El
// `call` se traduce a `&llamada=`, que abre la ficha de ESA llamada; el resto de la query viaja tal cual
// (`destinoDeClosing`, lib/graficos-plantillas.ts). Con `rutaConWs`, o el super admin mirando a un
// cliente terminaría en su propio Dashboard.
//
// La puerta la pone /dashboard (`requireRolWs(['closer'], { nav: 'graphics' })`, y al closer además la
// key `closing` en la capa): acá no se repite.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { destinoDeClosing } from '@/lib/graficos-plantillas';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoDeClosing(await searchParams)));
}
