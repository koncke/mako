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
// conversor de las secuencias de antes y «＋ o» del editor):
//   · [«MaKo contesta»]                         → responder = su cuerpo, sola = `revisar === false`;
//   · [«MaKo contesta» → «avisar al equipo»]    → lo mismo, y avisar;
//   · [«avisar al equipo»]                      → sólo avisar (no contesta: la charla pasa a una persona).
// Un caso sin nada debajo se pliega a un caso que no hace nada (Publicar lo marca: «no contesta ni avisa»).
// Y «Otra cosa» que es un «avisar al equipo» se pliega a `otra_aviso`; sin «Otra cosa», el aviso de siempre.
//
// ⚠️ TODO O NADA. Si UN caso tiene algo que no entra (una condición, una espera, un audio, un texto fijo,
// varios mensajes, una tarjeta a la que se llega también por otro lado, un «Ir a» que salta ahí), no se
// convierte NADA y se dice cuál: un AI Step a medias contestaría distinto de lo que se ve.
//
// ⚠️ LO QUE SE PIERDE AL PLEGAR UN AVISO: su texto propio. El aviso de un caso del AI Step lleva el título
// del caso y lo que escribió el lead (`expandirPasoIA`); el `mensaje` que tuviera la tarjeta de antes no
// tiene dónde vivir en el caso. El de «Otra cosa», sí: es `otra_aviso`.
//
// Conserva el id del nodo y los ids de los casos (el clasificador devuelve el id del caso, y el motor
// deriva de ahí los de la expansión); las tarjetas plegadas se van del array.
// =============================================================================

import {
  type PasoGrafo, type CasoRespuesta,
  claseDe, esPasoIA, indicePorId, nodoPorId, normalizar, padresDe, OP_AVISO_EQUIPO, AVISO_OTRA_COSA,
} from './flujo-grafo';

export type ConversionPasoIA<P> = { pasos: P[] } | { error: string };

/** Lo de adentro de un caso plegado. */
type Adentro = Pick<CasoRespuesta, 'responder' | 'sola' | 'avisar'>;

/**
 * Pasa el «Si responde» `idRespuesta` (o el único que haya) a un AI Step. `{ error }` con un motivo corto
 * —va a la pantalla— si no hay, si ya lo es, o si algo no se puede plegar.
 */
export function respuestaAPasoIA<P extends PasoGrafo>(pasosIn: readonly P[], idRespuesta?: string): ConversionPasoIA<P> {
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
    if (!primero) return {};
    const n = nodoPorId(base, primero);
    if (!n || !soloDesde(primero, desde)) return null;
    if (esAviso(n)) { quitar.add(primero); return { avisar: true }; }
    if (!esContesta(n)) return null;
    const adentro: Adentro = {
      ...((n.cuerpo ?? '').trim() ? { responder: (n.cuerpo ?? '').trim() } : {}),
      ...(n.revisar === false ? { sola: true } : {}),
    };
    const sigue = n.siguiente ?? null;
    if (sigue) {
      const a = nodoPorId(base, sigue);
      if (!esAviso(a) || !soloDesde(sigue, primero)) return null;
      quitar.add(sigue);
      adentro.avisar = true;
    }
    quitar.add(primero);
    return adentro;
  };

  const casos: CasoRespuesta[] = [];
  for (const c of r.casos ?? []) {
    const adentro = plegar(r.id!, c.siguiente ?? null);
    if (!adentro) return { error: `«${c.titulo.trim() || 'Un caso'}» tiene tarjetas que no entran en un AI Step` };
    casos.push({ id: c.id, titulo: c.titulo, cuando: c.cuando, siguiente: null, ...adentro });
  }

  // «Otra cosa»: un aviso que termina ahí, o nada (el aviso de siempre).
  let otra: string | null = null;
  if (r.si_no) {
    const n = nodoPorId(base, r.si_no);
    if (!n || !esAviso(n) || !soloDesde(r.si_no, r.id!)) return { error: '«Otra cosa» no es un aviso' };
    const m = (n.accion as { params?: { mensaje?: unknown } } | null | undefined)?.params?.mensaje;
    const texto = typeof m === 'string' ? m.trim() : '';
    if (texto && texto !== AVISO_OTRA_COSA) otra = texto;
    quitar.add(r.si_no);
  }

  const ia = { ...r, paso_ia: true as const, casos, si_no: null, ...(otra ? { otra_aviso: otra } : {}) } as P;
  const out = base.filter((q) => !quitar.has(q.id!)).map((q) => (q.id === r.id ? ia : q));
  return { pasos: normalizar(out) };
}
