// =============================================================================
// setter-ia-reglas — qué es «el setter con IA» dentro de una automatización (14/11/2026, puro)
// =============================================================================
// Martín (14/11/2026): MaKo Esencial NO trae «el setter con IA, que contesta y agenda solo por WhatsApp e Instagram»; Pro sí
// (`FUNCIONES_SOLO_PRO`, 'setter-ia', lib/topes-plan.ts). En el código, el setter es la IA que le CONTESTA SOLA a un lead que
// le escribió, dentro de una automatización. Son dos formas del mismo motor (lib/nutricion.ts → `redactarRespuesta`, el paso
// «¿SALE SOLA?»):
//   · un escenario del AI Step con libertad «Sola» (`libertadDeCaso`, lib/ai-step-libertad.ts): la expansión
//     (`expandirPasoIA`, lib/flujo-grafo.ts) lo vuelve un «MaKo contesta» con `revisar: false`;
//   · un «MaKo contesta» (`tipo: 'ia'`) colgado de «Si responde» con `revisar === false` (la forma de siempre; hoy lo escriben
//     la API, `agregar_escenario_secuencia` con `contestaSolo`, y el hand-off que se enseña).
//
// LO QUE NO ES EL SETTER, y sigue abierto en Esencial (la frontera más conservadora: candado sólo en lo que le contesta SOLO a
// un lead con IA):
//   · «Para aprobar»: MaKo deja la respuesta en Chats › Borradores y la manda una persona (como el Media Buyer en «propone»);
//   · «Sólo te avisa»: MaKo lee el mensaje y avisa al equipo; no le escribe al lead;
//   · un mensaje en «modo IA» FUERA de «Si responde»: adapta un texto fijo de la secuencia, no contesta;
//   · la IA que ayuda a ARMAR (Crear con IA, «✦ Armar» del AI Step, «MaKo redacta», las variantes) y MaKo en WhatsApp para el
//     DUEÑO del negocio (lib/mako-bot.ts, los grupos): le contesta a él, no a sus leads.
//
// Quién lo usa: el candado al ACTIVAR (lib/tope-automations.ts → `topeAlActivar`), el de GUARDAR los pasos (lib/nutricion.ts →
// `setSecuenciaPasos`, con `setterNuevoSoloPro`), las plantillas de un Esencial (lib/plantilla-crear.ts: «Sola» nace «Para
// aprobar») y la pantalla (app/automations/EditorPasoIA.tsx: «Sola» con el candado).
// ⚠️ PURO y sin `server-only`: lo importan el lienzo (cliente), el motor y los tests.
// =============================================================================

import { claseDe, descendientes, esPasoIA, idDe, raicesRespuesta, type CasoRespuesta, type PasoGrafo } from './flujo-grafo';
import { conLibertad, libertadDeCaso } from './ai-step-libertad';
import { textoSoloPro } from './topes-plan';

/** El texto del candado: «El setter con IA es de MaKo Pro. Pasa a Pro para usarlo.» (`textoSoloPro`). */
export const TEXTO_SETTER_SOLO_PRO = textoSoloPro('setter-ia');

/** ¿El error es el candado del setter? (lo tira `setSecuenciaPasos` como `TopeDelPlanError`; lo reconoce quien no lo importa). */
export const esCandadoSetterIA = (e: unknown): boolean => e instanceof Error && e.message === TEXTO_SETTER_SOLO_PRO;

const esPaso = (p: unknown): p is PasoGrafo => !!p && typeof p === 'object';

/** Los ids de lo que cuelga de las tarjetas que escuchan («Si responde», conectadas al CRON), sin ellas. */
function colgadoDeRespuesta(pasos: readonly PasoGrafo[]): Set<string> {
  const out = new Set<string>();
  for (const r of raicesRespuesta(pasos)) for (const id of descendientes(pasos, r)) out.add(id);
  return out;
}

/** ¿Este escenario del AI Step le contesta solo al lead? («Sola», la MISMA lectura que la tarjeta, el editor y el motor.) */
export const escenarioContestaSolo = (c: CasoRespuesta | null | undefined): boolean => libertadDeCaso(c) === 'sola';

/** ¿El paso `i` le contesta SOLO a un lead con IA? `respuestas`: lo que cuelga de «Si responde» (`colgadoDeRespuesta`). */
function contestaSoloElPaso(p: PasoGrafo, i: number, respuestas: ReadonlySet<string>): boolean {
  // Un AI Step suelto (sin la flecha del CRON) no escucha: el motor no lo expande (`expandirPasoIA`).
  if (esPasoIA(p)) return p.suelta !== true && (p.casos ?? []).some(escenarioContestaSolo);
  return claseDe(p) === 'mensaje' && p.tipo === 'ia' && p.revisar === false && respuestas.has(idDe(p, i));
}

/** ¿Estos pasos tienen el setter con IA? (algo que le contesta SOLO a un lead con IA; ver la cabecera). Lo que no es una lista de pasos, no. */
export function tieneSetterIA(pasos: unknown): boolean {
  if (!Array.isArray(pasos) || !pasos.length || !pasos.every(esPaso)) return false;
  const lista = pasos as readonly PasoGrafo[];
  const respuestas = colgadoDeRespuesta(lista);
  return lista.some((p, i) => contestaSoloElPaso(p, i, respuestas));
}

/**
 * ¿La FILA tiene el setter, contando la forma de ANTES? El modo asistido sin «Si responde» (lib/nutricion.ts →
 * `asistirRespuesta`) clasifica contra `estrategia.escenarios` y contesta solo los que tienen `contestaSolo`. Sólo cuenta si
 * ninguna tarjeta escucha: con «Si responde» o un AI Step conectado, el motor usa los pasos y la estrategia no contesta.
 */
export function filaConSetterIA(pasos: unknown, escenarios: ReadonlyArray<{ contestaSolo?: boolean } | null> | null | undefined): boolean {
  if (tieneSetterIA(pasos)) return true;
  const escucha = Array.isArray(pasos) && pasos.every(esPaso) && raicesRespuesta(pasos as readonly PasoGrafo[]).length > 0;
  return !escucha && Array.isArray(escenarios) && escenarios.some((e) => e?.contestaSolo === true);
}

/**
 * ¿Guardar `nuevos` sobre `antes` SUMA el setter? Un candado frena lo NUEVO: lo que ya tenía (un Pro que pasó a Esencial) se
 * puede seguir editando; lo que se frena es crearlo donde no estaba.
 */
export const sumaSetterIA = (antes: unknown, nuevos: unknown): boolean =>
  tieneSetterIA(nuevos) && !tieneSetterIA(antes);

/**
 * Para lo que CREA MaKo (una plantilla, «Crear con IA»): guarda los pasos con `guardar` (la puerta, `setSecuenciaPasos`) y, si
 * la puerta frena el setter (MaKo Esencial), los guarda otra vez SIN el setter (`sinSetterIA`). Lo creado nace entero y MaKo deja
 * sus respuestas para que una persona las mande, en vez de no crearse. Quién es Esencial lo decide la puerta, no esto. Cualquier
 * otro rechazo sigue como siempre. NO va en lo que publica una persona (el lienzo, la API): ahí el candado se dice.
 */
export async function guardarSinSetterSiFrena<P extends PasoGrafo>(pasos: readonly P[], guardar: (ps: P[]) => Promise<void>): Promise<void> {
  try {
    await guardar([...pasos]);
  } catch (e) {
    if (!esCandadoSetterIA(e) || !tieneSetterIA(pasos)) throw e;
    await guardar(sinSetterIA(pasos));
  }
}

/**
 * Los mismos pasos SIN el setter: cada «Sola» pasa a «Para aprobar» (`conLibertad`, la única que escribe la libertad) y cada
 * «MaKo contesta» que salía solo queda para aprobar (`revisar: true`). Lo demás, tal cual. Lo usan las plantillas de un
 * Esencial (lib/plantilla-crear.ts): la plantilla nace entera y MaKo deja sus respuestas para que una persona las mande.
 */
export function sinSetterIA<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  if (!pasos.every(esPaso)) return [...pasos];
  const respuestas = colgadoDeRespuesta(pasos);
  return pasos.map((p, i) => {
    if (esPasoIA(p)) {
      const casos = p.casos ?? [];
      return casos.some(escenarioContestaSolo) ? { ...p, casos: casos.map((c) => (escenarioContestaSolo(c) ? conLibertad(c, 'aprueba') : c)) } : p;
    }
    return contestaSoloElPaso(p, i, respuestas) ? { ...p, revisar: true } : p;
  });
}
