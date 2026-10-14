// =============================================================================
// paso-ia-convertir — un «Si responde» de los de siempre, PLEGADO a un AI STEP (puro, con test)
// =============================================================================
// Pedido de Martín (10/10/2026, novena tanda): «Todo lo que hiciste de una cantidad impresionante de flujos y
// tarjetas eso justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí». El AI
// Step es una FORMA del nodo `respuesta` con lo de cada caso ADENTRO (lib/flujo-grafo.ts, «EL AI STEP»).
// Esto pasa un «Si responde» de los de siempre —una tarjeta hija por caso— a esa forma, cuando se puede
// sin cambiar lo que hace.
//
// Se pliega un caso cuyo subárbol es exactamente una de estas tres formas (las que arman la galería, el
// conversor de las secuencias de antes y «＋ o» del editor). UNDÉCIMA TANDA: la LIBERTAD sale de la forma
// (`camposDeLibertad`, lib/ai-step-libertad.ts) y el aviso al grupo se deriva de ella:
//   · [«MaKo contesta» que sale solo]              → responder = su cuerpo, «Sola»;
//   · [«MaKo contesta» a revisar]                  → responder = su cuerpo, «Para aprobar»;
//   · [«MaKo contesta» → «avisar al equipo»]       → «Para aprobar» (también si salía solo: «Sola» no avisa, y
//                                                    una persona ve lo que avisaba; §7, «sola + te aviso»);
//   · [«avisar al equipo»] o nada debajo           → «Sólo te avisa» (no contesta: la charla pasa a una persona).
// Una «Sola» con plata baja a «Para aprobar» ACÁ, con la regla prudente (`libertadesDeFabrica`): en la forma de antes
// una respuesta que hablaba de plata quedaba en borrador igual (el freno del texto, `puedeContestarSolo`), y desde el
// 14/10/2026 una «Sola» elegida en un escenario de plata ya no frena: convertida así, contestaría distinto. Hasta el
// 14/10 lo hacía `juntarPasosIA`, que ahora deja la «Sola» que eligió una persona.
// «Otra cosa» que es un «avisar al equipo» se va: «Lo demás» avisa con el texto de siempre (`AVISO_OTRA_COSA`).
//
// ⚠️ TODO O NADA. Si UN caso tiene algo que no entra (una condición, una espera, un audio, un texto fijo,
// varios mensajes, una tarjeta a la que se llega también por otro lado, un «Ir a» que salta ahí), no se
// convierte NADA y se dice cuál: un AI Step a medias contestaría distinto de lo que se ve.
//
// ⚠️ LO QUE SE PIERDE AL PLEGAR UN AVISO: su texto propio. El aviso de un caso del AI Step lleva el título
// del caso y lo que escribió el lead (`expandirPasoIA`); el `mensaje` que tuviera la tarjeta de antes no
// tiene dónde vivir en el caso. Desde la undécima tampoco el de «Otra cosa» (`otra_aviso` se fue).
//
// Conserva el id del nodo y los ids de los casos (el clasificador devuelve el id del caso, y el motor
// deriva de ahí los de la expansión); las tarjetas plegadas se van del array. Queda UN AI Step. Su OBJETIVO lo pone quien
// convierte (`op.objetivo`: «Crear con IA» lo trae en la tarjeta `si_responde`, lib/flujo-ia.ts); sin él, Publicar lo
// pide y la tarjeta dice «Falta el objetivo» (el botón «Pasar a AI Step» del lienzo no lo sabe: lo escribe la persona).
// =============================================================================

import {
  type PasoGrafo, type CasoRespuesta,
  claseDe, esPasoIA, indicePorId, nodoPorId, normalizar, padresDe, juntarPasosIA, OP_AVISO_EQUIPO, TOPE_OBJETIVO,
} from './flujo-grafo';
import { conLibertad, libertadesDeFabrica, type Libertad } from './ai-step-libertad';

export type ConversionPasoIA<P> = { pasos: P[] } | { error: string };

/** Lo de adentro de un caso plegado: su respuesta y la libertad que sale de la forma. */
type Adentro = { responder?: string; libertad: Libertad };

/**
 * Pasa el «Si responde» `idRespuesta` (o el único que haya) a un AI Step. `{ error }` con un motivo corto
 * —va a la pantalla— si no hay, si ya lo es, o si algo no se puede plegar. `op.objetivo`: el del AI Step (sin espacios
 * de más, hasta `TOPE_OBJETIVO`); vacío o ausente, queda sin objetivo.
 */
export function respuestaAPasoIA<P extends PasoGrafo>(pasosIn: readonly P[], idRespuesta?: string, op: { objetivo?: string } = {}): ConversionPasoIA<P> {
  const base = normalizar(pasosIn);
  const i = idRespuesta ? indicePorId(base, idRespuesta) : base.findIndex((p) => claseDe(p) === 'respuesta');
  const r = i >= 0 ? base[i] : null;
  if (!r || claseDe(r) !== 'respuesta') return { error: 'No hay «Si responde»' };
  if (esPasoIA(r)) return { error: 'Ya es un AI Step' };

  const quitar = new Set<string>();
  /** ¿A esta tarjeta se llega SÓLO desde `desde`, por una flecha, y no salta nadie a ella? */
  const soloDesde = (id: string, desde: string): boolean => {
    const padres = padresDe(base, id);
    const saltan = base.some((q) => claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && q.destino.nodo === id);
    return padres.length === 1 && padres[0].id === desde && !saltan;
  };
  const sinParalelos = (p: PasoGrafo) => !(Array.isArray(p.paralelos) && p.paralelos.length);
  /** Un «avisar al equipo» que termina ahí. */
  // Booleanos y no `p is PasoGrafo`: sobre un `P` el predicado deja la rama de «no es» en `never`.
  const esAviso = (p: PasoGrafo | null): boolean => {
    if (!p || claseDe(p) !== 'accion' || p.siguiente != null || !sinParalelos(p)) return false;
    return (p.accion as { operacion?: unknown } | null | undefined)?.operacion === OP_AVISO_EQUIPO;
  };
  /** Un «MaKo contesta»: un WhatsApp escrito por MaKo, de un solo mensaje. */
  const esContesta = (p: PasoGrafo | null): boolean =>
    !!p && claseDe(p) === 'mensaje' && p.tipo === 'ia' && (p.canal ?? 'whatsapp') === 'whatsapp' && sinParalelos(p)
    && !(Array.isArray(p.partes) && p.partes.length > 1);

  /** Lo que cuelga de un caso, plegado; null = no entra. */
  const plegar = (desde: string, primero: string | null): Adentro | null => {
    if (!primero) return { libertad: 'avisa' };
    const n = nodoPorId(base, primero);
    if (!n || !soloDesde(primero, desde)) return null;
    if (esAviso(n)) { quitar.add(primero); return { libertad: 'avisa' }; }
    if (!esContesta(n)) return null;
    const responder = (n.cuerpo ?? '').trim();
    let libertad: Libertad = n.revisar === false ? 'sola' : 'aprueba';
    const sigue = n.siguiente ?? null;
    if (sigue) {
      const a = nodoPorId(base, sigue);
      if (!esAviso(a) || !soloDesde(sigue, primero)) return null;
      quitar.add(sigue);
      libertad = 'aprueba';
    }
    quitar.add(primero);
    return { ...(responder ? { responder } : {}), libertad: responder ? libertad : 'avisa' };
  };

  const casos: CasoRespuesta[] = [];
  for (const c of r.casos ?? []) {
    const adentro = plegar(r.id!, c.siguiente ?? null);
    if (!adentro) return { error: `«${c.titulo.trim() || 'Un caso'}» tiene tarjetas que no entran en un AI Step` };
    const escenario: CasoRespuesta = { id: c.id, titulo: c.titulo, cuando: c.cuando, siguiente: null, ...(adentro.responder ? { responder: adentro.responder } : {}) };
    // La libertad de la forma, con la regla prudente (ver la cabecera): contesta IGUAL que antes de convertir.
    casos.push(conLibertad(escenario, libertadesDeFabrica(escenario).includes(adentro.libertad) ? adentro.libertad : 'aprueba'));
  }

  // «Otra cosa»: un aviso que termina ahí, o nada. Las dos son «Lo demás: Sólo te avisa» (el default: sin caso).
  if (r.si_no) {
    const n = nodoPorId(base, r.si_no);
    if (!n || !esAviso(n) || !soloDesde(r.si_no, r.id!)) return { error: '«Otra cosa» no es un aviso' };
    quitar.add(r.si_no);
  }

  const objetivo = (op.objetivo ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPE_OBJETIVO);
  const ia = { ...r, paso_ia: true as const, casos, si_no: null, ...(objetivo ? { objetivo } : {}) } as P;
  const out = base.filter((q) => !quitar.has(q.id!)).map((q) => (q.id === r.id ? ia : q));
  // UNDÉCIMA TANDA: UN AI Step con todos los escenarios adentro (`juntarPasosIA` deja la forma de hoy: sin campos
  // de antes). Un «Si responde» sin casos queda un AI Step sin escenarios: «Lo demás: Sólo te avisa».
  return { pasos: normalizar(juntarPasosIA(normalizar(out)).pasos) };
}
