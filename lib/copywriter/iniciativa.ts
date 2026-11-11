// =============================================================================
// copywriter/iniciativa — MaKo toma la iniciativa al crear desde una plantilla: pregunta, con botones (PURO)
// =============================================================================
// Martín (29/10/2026): «automáticamente, cuando se crea un copy, MaKo le pregunta: "¿cuál es el objetivo de esto?
// ¿quieres que lo adapte?"», y en todo chat de MaKo «que te vaya guiando… EN LUGAR de que esté en la top bar arriba
// "adaptar con MaKo"». La página nace con la estructura (./plantillas.ts) y el chat del costado abre con UNA pregunta y
// botones, de a una:
//   1. «¿Para qué es este guion?»: los objetivos de la plantilla (./plantillas-guias.ts), o lo que escriba la persona;
//   2. «¿Lo adapto a tu oferta? ¿A cuál?»: las ofertas del negocio como botones, y «No, lo escribo yo».
// Las preguntas se arman SIN IA (se ven aunque no esté la app de escritorio): la IA del negocio entra recién con la
// última respuesta, con el pedido que arma `pedidoDeIniciativa`.
//
// LA FORMA ES LA DEL PATRÓN COMÚN («MaKo toma la iniciativa», el Cerebro lo arma para todas las tabs): una lista de
// `PasoIniciativa` (pregunta, opciones, si acepta texto libre) y una función de las respuestas al pedido. La pantalla
// (app/copywriter/PanelMaKo.tsx) sólo dibuja pasos y junta respuestas: mudarla al patrón es cambiar de dónde salen.
// =============================================================================

export type OpcionIniciativa = { valor: string; texto: string };

/** Una pregunta de MaKo: su texto, los botones y si se puede contestar escribiendo. */
export type PasoIniciativa = { id: string; pregunta: string; opciones: readonly OpcionIniciativa[]; libre: boolean };

export type RespuestasIniciativa = Readonly<Record<string, string>>;

/** Lo que vuelve de las respuestas: el pedido para la IA (adaptar) o nada que pedir (lo escribe la persona). */
export type PedidoIniciativa = { adaptar: true; texto: string } | { adaptar: false; texto: string };

/** «No, lo escribo yo»: no se llama a la IA. */
export const NO_ADAPTAR = 'no';
/** Sin ofertas cargadas: adaptar al negocio con lo que tenga. */
export const AL_NEGOCIO = 'negocio';
/** Cuántas ofertas entran como botones (la principal primero: `listarOfertas` ordena así). */
export const TOPE_OFERTAS = 4;

export type OfertaCorta = { id: number; nombre: string };

/** Los pasos de la plantilla: para qué es y a qué oferta adaptarlo. */
export function pasosDeIniciativa(pl: { objetivos?: readonly string[] }, ofertas: readonly OfertaCorta[]): PasoIniciativa[] {
  const objetivo: PasoIniciativa = {
    id: 'objetivo', pregunta: '¿Para qué es este guion?', libre: true,
    opciones: (pl.objetivos ?? []).map((t) => ({ valor: t, texto: t })),
  };
  const oferta: PasoIniciativa = ofertas.length
    ? {
      id: 'oferta', pregunta: '¿Lo adapto a tu oferta? ¿A cuál?', libre: false,
      opciones: [...ofertas.slice(0, TOPE_OFERTAS).map((o) => ({ valor: `oferta:${o.id}`, texto: o.nombre })), { valor: NO_ADAPTAR, texto: 'No, lo escribo yo' }],
    }
    : {
      id: 'oferta', pregunta: '¿Lo adapto a tu negocio?', libre: false,
      opciones: [{ valor: AL_NEGOCIO, texto: 'Sí, adáptalo' }, { valor: NO_ADAPTAR, texto: 'No, lo escribo yo' }],
    };
  return [objetivo, oferta];
}

/** El paso que sigue (el primero sin respuesta), o null si ya contestó todo. */
export const pasoPendiente = (pasos: readonly PasoIniciativa[], r: RespuestasIniciativa): PasoIniciativa | null => pasos.find((p) => !(p.id in r)) ?? null;

/** El texto de una respuesta, como se ve en el chat (el del botón, o lo escrito). */
export function textoDeRespuesta(paso: PasoIniciativa, valor: string): string {
  return paso.opciones.find((o) => o.valor === valor)?.texto ?? valor;
}

/**
 * Las respuestas, ya completas, al pedido: con «No, lo escribo yo» no se pide nada; si no, la frase que va a la IA (y que
 * se ve en el chat como lo que dijo la persona): para qué es y a qué oferta adaptarlo.
 */
export function pedidoDeIniciativa(pasos: readonly PasoIniciativa[], r: RespuestasIniciativa, ofertas: readonly OfertaCorta[]): PedidoIniciativa {
  const objetivo = (r.objetivo ?? '').trim();
  const oferta = r.oferta ?? AL_NEGOCIO;
  if (oferta === NO_ADAPTAR) return { adaptar: false, texto: 'No, lo escribo yo.' };
  const para = objetivo ? `Es para: ${objetivo}.` : '';
  const id = oferta.startsWith('oferta:') ? Number(oferta.slice('oferta:'.length)) : NaN;
  const nombre = Number.isFinite(id) ? ofertas.find((o) => o.id === id)?.nombre : null;
  const pasoOferta = pasos.find((p) => p.id === 'oferta');
  const cual = nombre ? `Adáptalo a mi oferta «${nombre}».`
    : oferta === AL_NEGOCIO ? 'Adáptalo a mi negocio.'
      : `Adáptalo a: ${pasoOferta ? textoDeRespuesta(pasoOferta, oferta) : oferta}.`;
  return { adaptar: true, texto: [para, cual].filter(Boolean).join(' ') };
}

// ── Replicar un outlier (11/11/2026, docs/diseno-copywriter.md D18) ──────────────────────────────────────────────────
// La página nace vacía de «Replicar» (lib/copywriter/outliers-servidor.ts) y MaKo toma la iniciativa como con una plantilla,
// con UNA pregunta: para qué oferta. El original le llega por el server en cada pedido (lib/copywriter/ia.ts, `conElOriginal`).

/** La única pregunta de una réplica: para qué oferta (o el negocio, si no hay ofertas cargadas). */
export function pasosDeReplica(ofertas: readonly OfertaCorta[]): PasoIniciativa[] {
  return [ofertas.length
    ? {
      id: 'oferta', pregunta: '¿Lo replico para tu oferta? ¿Para cuál?', libre: false,
      opciones: [...ofertas.slice(0, TOPE_OFERTAS).map((o) => ({ valor: `oferta:${o.id}`, texto: o.nombre })), { valor: NO_ADAPTAR, texto: 'No, lo escribo yo' }],
    }
    : {
      id: 'oferta', pregunta: '¿Lo replico para tu negocio?', libre: false,
      opciones: [{ valor: AL_NEGOCIO, texto: 'Sí, replícalo' }, { valor: NO_ADAPTAR, texto: 'No, lo escribo yo' }],
    }];
}

/** La respuesta al pedido de escribir la réplica: la estructura, el gancho y el ritmo del original, con la oferta elegida. */
export function pedidoDeReplica(r: RespuestasIniciativa, ofertas: readonly OfertaCorta[]): PedidoIniciativa {
  const oferta = r.oferta ?? AL_NEGOCIO;
  if (oferta === NO_ADAPTAR) return { adaptar: false, texto: 'No, lo escribo yo.' };
  const id = oferta.startsWith('oferta:') ? Number(oferta.slice('oferta:'.length)) : NaN;
  const nombre = Number.isFinite(id) ? ofertas.find((o) => o.id === id)?.nombre : null;
  const con = nombre ? `con mi oferta «${nombre}»` : 'con mi negocio';
  return { adaptar: true, texto: `Escríbelo como el original: su misma estructura, su tipo de gancho y su ritmo, ${con}.` };
}
