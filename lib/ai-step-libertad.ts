// =============================================================================
// ai-step-libertad — cuánta LIBERTAD tiene un escenario del AI Step (undécima tanda, puro)
// =============================================================================
// Martín (11/10/2026, punto 13): «En el paso de "Libertad" lo complejizaste al pedo... Solo basta con los primeros 3
// botones, que me gustaría que sean un desplegable... El "Hasta" siempre es atado al objetivo. Y el "Te avisa cada
// vez" ya es uno de los 3 botones». El diseño, en docs/diseno-undecima-tanda.md §2 (punto 13) y §6.
//
// UNA libertad por escenario, tres valores: «Sólo te avisa» ('avisa') · «Para aprobar» ('aprueba') · «Sola» ('sola').
//   · `libertadDeCaso` la LEE de los campos del caso (`responder`, `no_contesta`, `sola`): la tarjeta, el editor, el
//     freno de Publicar y la expansión del motor leen la MISMA.
//   · `camposDeLibertad` es la ÚNICA que ESCRIBE `sola` / `no_contesta` (con `conLibertad`, que además saca lo de
//     antes). Escritos a mano en cada pantalla, la «Sola + Sólo te avisa» de la décima volvía a nacer.
//   · `libertadesPermitidas`: sin «Sola» si el escenario habla de PLATA (`HABLA_DE_PLATA`, la misma regla que la
//     guarda del motor, lib/setter-conversacion.ts) o si es «Lo demás» (Martín, 06/10: «sola sólo para confirmar y
//     reprogramar»). Sin cómo responder, sólo «Sólo te avisa». La usan el desplegable (las demás van deshabilitadas),
//     Publicar (`erroresDelPasoIA`) y `juntarPasosIA` (lo de antes que no entra baja a la que sí).
//   · `avisaElCaso`: el AVISO AL GRUPO se DERIVA de la libertad (decisión §9.15). «Para aprobar» siempre avisa (sin
//     eso, el ws1 —sin «Aviso cuando un lead te escribe»— dejaba borradores para aprobar que no le llegaban a nadie),
//     «Sola» no avisa y «Sólo te avisa» avisa. El campo `avisar` del caso se va (sólo lo lee `juntarPasosIA`).
//
// ⚠️ PURO Y SIN `server-only`: lo importan el lienzo (cliente), el modelo (lib/flujo-grafo.ts), el motor y los
// tests. Del modelo importa sólo TIPOS: lib/flujo-grafo.ts importa a éste (y re-exporta `contestaElCaso`), así que
// un import de valor de vuelta sería un ciclo en runtime.
// =============================================================================

import type { CasoRespuesta } from './flujo-grafo';
// Sólo importa tipos y lib/prompt-render-pure (sin imports): no arrastra el server al cliente.
import { HABLA_DE_PLATA } from './setter-conversacion';

/** Cuánta libertad tiene un escenario. UN tipo para la tarjeta, el editor, el armado y el motor. */
export type Libertad = 'avisa' | 'aprueba' | 'sola';

/** Las tres, en el orden del desplegable. */
export const LIBERTADES: readonly Libertad[] = ['avisa', 'aprueba', 'sola'];

/** Cómo se dice cada una en el desplegable (corto: va en una fila). */
export const ROTULO_LIBERTAD: Readonly<Record<Libertad, string>> = { avisa: 'Sólo te avisa', aprueba: 'Para aprobar', sola: 'Sola' };

/** Lo que estas funciones leen de un escenario. */
type CasoLibertad = Pick<CasoRespuesta, 'responder' | 'no_contesta' | 'sola'>;

/** ¿Este escenario CONTESTA? Tiene cómo responder y no es «Sólo te avisa». La MISMA regla para expandir, dibujar y frenar. */
export const contestaElCaso = (c: Pick<CasoRespuesta, 'responder' | 'no_contesta'>): boolean =>
  !!(c.responder ?? '').trim() && c.no_contesta !== true;

/** La LIBERTAD de un escenario, leída de sus campos. Sin escenario o sin respuesta, «Sólo te avisa». */
export function libertadDeCaso(c: CasoLibertad | null | undefined): Libertad {
  if (!c || !contestaElCaso(c)) return 'avisa';
  return c.sola === true ? 'sola' : 'aprueba';
}

/**
 * LOS CAMPOS QUE ESCRIBE UNA LIBERTAD. La única que escribe `sola` / `no_contesta`: «avisa» = no contesta (lo que
 * tenga en `responder` se guarda para cuando vuelva a contestar), «aprueba» = nada (ausente = a revisar), «sola» =
 * sale sola.
 */
export function camposDeLibertad(l: Libertad): Pick<CasoRespuesta, 'sola' | 'no_contesta'> {
  if (l === 'avisa') return { no_contesta: true };
  if (l === 'sola') return { sola: true };
  return {};
}

/**
 * El escenario con OTRA libertad: saca lo que escribía la de antes (`sola`, `no_contesta` y el `avisar` de la décima,
 * que ya no se lee) y pone lo de la nueva (`camposDeLibertad`). Devuelve una copia.
 */
export function conLibertad<C extends CasoLibertad & Pick<CasoRespuesta, 'avisar'>>(c: C, l: Libertad): C {
  const { sola: _s, no_contesta: _n, avisar: _a, ...resto } = c;
  void _s; void _n; void _a;
  return { ...resto, ...camposDeLibertad(l) } as C;
}

/** ¿El escenario habla de plata? Su nombre, su «cuándo» y su respuesta, con la regla del motor (`HABLA_DE_PLATA`). */
export function hablaDePlata(c: Pick<CasoRespuesta, 'titulo' | 'cuando' | 'responder'>): boolean {
  return HABLA_DE_PLATA.test(`${c.titulo ?? ''}\n${c.cuando ?? ''}\n${c.responder ?? ''}`);
}

/**
 * LAS LIBERTADES QUE UN ESCENARIO PUEDE TENER, en el orden del desplegable. Sin cómo responder, sólo «Sólo te
 * avisa»; con plata o «Lo demás» (`cualquiera`), nunca «Sola».
 */
export function libertadesPermitidas(c: Pick<CasoRespuesta, 'titulo' | 'cuando' | 'responder' | 'cualquiera'>): Libertad[] {
  if (!(c.responder ?? '').trim()) return ['avisa'];
  if (c.cualquiera === true || hablaDePlata(c)) return ['avisa', 'aprueba'];
  return [...LIBERTADES];
}

/** ¿El escenario te AVISA al grupo? Se deriva de la libertad: todo lo que no sale solo, avisa (§9.15). */
export const avisaElCaso = (c: CasoLibertad | null | undefined): boolean => libertadDeCaso(c) !== 'sola';
