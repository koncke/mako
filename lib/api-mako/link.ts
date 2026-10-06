// =============================================================================
// Los links que la API de MaKo le DEVUELVE a un agente
// =============================================================================
// Toda operación del registro contesta con links a pantallas de MaKo: la bandeja de
// pendientes, la propuesta que hay que confirmar, la ficha de una integración. Esas
// pantallas viven DENTRO de un workspace, así que el link lleva su `?ws=` — es la
// QUINTA forma de navegar de AGENTS.md, la que se abre desde afuera de la app (un
// chat, un correo, la consola de quien integró por bearer) y donde el parámetro es lo
// único que dice de quién son los datos.
//
// Antes cada área lo armaba pegando `${APP_BASE_URL}` + la ruta a mano: 17 lugares en
// cinco archivos, y el guard de los links no podía verlos porque su regex exige una
// ruta LITERAL pegada a la interpolación y acá la ruta casi siempre es una variable
// (`${RUTA_BANDEJA}`, `${rutaDePropuesta(...)}`, `${c.ruta}`). Lo encontró el relevo
// del 06/10/2026 contando las interpolaciones del repo, no leyendo el guard.
//
// ⚠️ EL `ws` DEL CONTEXTO ES VÁLIDO ACÁ, Y NO LO ES EN CUALQUIER PARTE. Toda operación
// del registro corre adentro de un `runWithWorkspace(ctx.ws, …)`: lo hace la ÚNICA
// puerta de ejecución (`lib/api-mako/ejecutar.ts:69`) y también `acciones.ts:115` para
// las que confirman. Por eso `wsEnContexto()` no puede devolver null en este camino.
// Donde el `ctx` esté a mano se pasa explícito igual, que es lo único que no depende de
// que el llamador esté adentro del envoltorio.
//
// Si algún día alguien lo llama desde afuera de ese contexto, `linkApp` devuelve el
// link PELADO en vez de uno con `ws=null`: se pierde el destino exacto, no se gana uno
// equivocado. Es la misma decisión que ya está escrita en `lib/app-url.ts`.

import { linkApp } from '@/lib/app-url';
import { wsEnContexto } from '@/lib/workspace';

/**
 * Un link absoluto a una pantalla de MaKo, con el workspace puesto.
 *
 * @param ruta  la ruta de la pantalla, con su query si la tiene (`/mako/revisar/abc`).
 * @param ws    el workspace, cuando el llamador lo tiene en la mano (`ctx.ws`). Si no
 *              se pasa, sale el del contexto en curso.
 */
export function linkPantalla(ruta: string, ws?: number | null): string {
  return linkApp(ruta, ws ?? wsEnContexto());
}
