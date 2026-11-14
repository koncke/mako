// =============================================================================
// editores-ia-pro — «Editar con IA» en los editores de imagen y de video es SÓLO de MaKo Pro (14/11/2026)
// =============================================================================
// Martín: «el editor de imágenes y editor de videos sí deberían estar disponibles para la versión de 47, pero no deberían
// estar disponibles el tema de editar con inteligencia artificial». Los editores son de los dos planes (salieron de
// `TABS_SOLO_PRO` y de `NAV_SOLO_PRO`); lo de Pro es su IA: `FUNCIONES_SOLO_PRO`, 'ia-editores' (lib/topes-plan.ts).
//
// ESTE ES EL CANDADO DEL SERVIDOR, en cada punto que llama a la IA desde un editor (la pantalla no es la única puerta: una
// ruta se llama a mano, y la API de MaKo no tiene pantalla):
//   · app/api/image-editor/ia (el chat «MaKo IA»), carruseles/replicar («Editar» un ejemplo, y «Replicar en Image» de
//     Competitor Spy) y carruseles/leer (la lectura con la IA que sólo sirve para ese «Editar»);
//   · app/api/video-editor/ia (el chat «Editar con IA»), clips («Clips mágicos») y broll, SÓLO `elegir` (la IA elige dónde
//     va cada imagen; buscar en Pexels y bajar la foto no usan IA y quedan abiertos);
//   · la API de MaKo: `editar_ejemplo_carrusel` y `editar_ejemplo_thumbnail` (lib/api-mako/areas/imagen.run.ts).
// Lo que NO lleva candado, a propósito: lo que no llama a la IA aunque viva al lado (el hilo guardado del chat, la búsqueda de
// Pexels, `crear_carrusel_desde_referencia` —la estructura con guías, sin IA— y `cambiar_textos_diseno_imagen`, que sólo
// reemplaza textos). La «Edición automática» corre en el navegador: su candado está en el botón y en `correrEnjambre`.
//
// ⚠️ ANTE LA DUDA, PASA: `esEsencialDe` / `esEsencialDeLaSesion` (lib/plan-esencial.ts) ya devuelven `false` si no pueden
//    leer el plan. Sacarle la IA a quien paga Pro es peor que dejársela a un Esencial un rato.
// ⚠️ La respuesta es la de toda ruta de los editores (`{ ok: false, error }`, sin caché) con `pasarAPro`: la pantalla la
//    reconoce por ese campo y dibuja el candado (app/_components/solo-pro.ts → `esRespuestaSoloPro`).
// =============================================================================

import 'server-only';
import { esEsencialDe, esEsencialDeLaSesion } from './plan-esencial';
import { RUTA_CAMBIAR_PLAN, textoSoloPro } from './topes-plan';
import { rutaConWs } from './workspace';

/** Para las rutas de los editores (con sesión). `null` = pasa; si no, el 403 tal cual, para devolverlo. */
export async function candadoIaDeEditores(): Promise<Response | null> {
  if (!(await esEsencialDeLaSesion())) return null;
  return Response.json(
    { ok: false, error: textoSoloPro('ia-editores'), pasarAPro: await rutaConWs(RUTA_CAMBIAR_PLAN) },
    { status: 403, headers: { 'cache-control': 'no-store' } },
  );
}

/** Para la API de MaKo (sin sesión: el negocio es `ctx.ws`). `null` = pasa; si no, el texto del candado. */
export async function candadoIaDeEditoresDe(ws: number): Promise<string | null> {
  return (await esEsencialDe(ws)) ? textoSoloPro('ia-editores') : null;
}
