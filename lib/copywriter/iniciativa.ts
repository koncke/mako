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
// La página nace vacía de «Replicar» (lib/copywriter/outliers-servidor.ts) y MaKo la escribe SOLA al abrirla, con la oferta
// principal (app/copywriter/PanelMaKo.tsx); la oferta se cambia después. El original le llega por el server en cada pedido
// (lib/copywriter/ia.ts, `conElOriginal`). Hasta el 11/11/2026 preguntaba primero para qué oferta, y eso frenaba el cuerpo.

/** La respuesta al pedido de escribir la réplica: la estructura, el gancho y el ritmo del original, con la oferta elegida. */
export function pedidoDeReplica(r: RespuestasIniciativa, ofertas: readonly OfertaCorta[], temaOriginal: string | null = null): PedidoIniciativa {
  const oferta = r.oferta ?? AL_NEGOCIO;
  if (oferta === NO_ADAPTAR) return { adaptar: false, texto: 'No, lo escribo yo.' };
  const nombre = nombreDeOferta(oferta, ofertas);
  const con = nombre ? `con mi oferta «${nombre}»` : 'con mi negocio';
  // El guion ENTERO y las propiedades (11/11/2026, Martín: «lo único que me replica es el título… ¿y dónde está todo el
  // cuerpo?», y el Ángulo y la Estructura quedaban «Vacío») los pide el ORIGINAL que manda el server en cada pedido de la página
  // (./outliers.ts → reglasDeLaReplica). Acá va lo que la persona pidió con un toque: al reabrir la página, este renglón es su
  // mensaje en la charla (12/11/2026, en producción: el pedido técnico entero aparecía como si lo hubiera escrito Martín).
  const partes = [`Replícalo entero ${con}: su estructura, su tipo de gancho y su ritmo.`];
  // Lo que la persona contestó de su oferta (13/11/2026): ya quedó guardado en la oferta, pero va también acá por si guardarlo falló.
  const datos = LO_MINIMO_REPLICA.map((c) => [c, (r[`${FALTA}${c}`] ?? '').trim()] as const).filter(([, v]) => v && v !== SEGUIR_SIN && v !== EN_OFFER);
  if (datos.length) partes.push(`De la oferta: ${datos.map(([c, v]) => `${c}: ${v}`).join('; ')}.`);
  // Cómo usar un original que no tiene que ver con el negocio (la pregunta de `pasoDeReplica`).
  const de = temaOriginal ? `El original habla de ${temaOriginal}` : 'El original habla de otra cosa';
  if (r.tema === SOLO_ESTRUCTURA) partes.push(`${de}: toma sólo su tipo de gancho y su estructura; el tema y todo lo que se dice son de mi oferta.`);
  if (r.tema === LLEVAR_TEMA) partes.push(`${de}: lleva su idea a mi negocio, la misma promesa contada con lo que vendo (sin hablar de su tema).`);
  return { adaptar: true, texto: partes.join(' ') };
}

// ── Lo que MaKo pregunta ANTES de escribir la réplica (13/11/2026, la maqueta que aprobó el Cerebro) ─────────────────────────
// Martín, el relevo: «no me hace las preguntas… tampoco en un momento me pregunta sobre qué oferta, incluso escribe casi que
// cualquier cosa». Antes de escribir, de a una y con botones: 1) para qué oferta; 2) lo que le FALTA a esa oferta de lo mínimo
// (para quién, qué promete, qué incluye, precio), que se guarda en la oferta; 3) si el original no tiene que ver con el negocio,
// cómo usarlo. Con todo contestado, escribe la pieza entera (sin «Aceptar»). Las preguntas no llaman a la IA.

/** El prefijo de la respuesta a un dato que falta (`falta:para quién`). */
export const FALTA = 'falta:';
/** «Seguir sin eso»: lo que falta queda como [DATO: …] y no se pregunta más. */
export const SEGUIR_SIN = 'seguir-sin';
/** «Completarla en Offer»: la pantalla lleva a Offer (no es una respuesta que se guarde). */
export const EN_OFFER = 'en-offer';
/** Las dos maneras de usar un original de otro tema. */
export const SOLO_ESTRUCTURA = 'solo-estructura';
export const LLEVAR_TEMA = 'llevar-tema';
/** Lo mínimo de una oferta, en el orden en que se pregunta (el de lib/copywriter/oferta-elegida.ts, LO_MINIMO). */
export const LO_MINIMO_REPLICA = ['para quién', 'qué promete', 'qué incluye', 'precio'] as const;
const PREGUNTA_DATO: Readonly<Record<(typeof LO_MINIMO_REPLICA)[number], string>> = {
  'para quién': '¿Para quién es? (a quién le vendes)',
  'qué promete': '¿Qué les promete, en una frase?',
  'qué incluye': '¿Qué incluye? (lo que se lleva quien la compra)',
  precio: '¿Cuánto cuesta?',
};

/** Lo que la pregunta necesita saber (lo trae `prepararReplica`, lib/copywriter/replica-servidor.ts). */
export type PreparacionCorta = {
  tema: { original: { nombre: string } | null; negocio: { nombre: string } | null; relacionado: boolean };
  ofertas: readonly (OfertaCorta & { falta: readonly string[] })[];
};

/** La oferta elegida en las respuestas (null = el negocio en general, o todavía no eligió). */
export function ofertaElegida(p: PreparacionCorta, r: RespuestasIniciativa): (OfertaCorta & { falta: readonly string[] }) | null {
  const v = r.oferta ?? '';
  const id = v.startsWith('oferta:') ? Number(v.slice('oferta:'.length)) : NaN;
  return Number.isFinite(id) ? p.ofertas.find((o) => o.id === id) ?? null : null;
}

/** Lo que falta de la oferta elegida y todavía no se contestó (vacío con «Seguir sin eso»). */
export function faltaPorPreguntar(p: PreparacionCorta, r: RespuestasIniciativa): (typeof LO_MINIMO_REPLICA)[number][] {
  const o = ofertaElegida(p, r);
  if (!o || r.faltas === SEGUIR_SIN) return [];
  return LO_MINIMO_REPLICA.filter((c) => o.falta.includes(c) && !(`${FALTA}${c}` in r));
}

/**
 * La pregunta que sigue antes de escribir la réplica, o null (ya se puede escribir). Sin ofertas no pregunta por la oferta (escribe
 * para el negocio); una oferta COMPLETA no pregunta datos; un original del tema del negocio (o sin tema claro) no pregunta cómo usarlo.
 */
export function pasoDeReplica(p: PreparacionCorta, r: RespuestasIniciativa): PasoIniciativa | null {
  if (p.ofertas.length && !('oferta' in r)) {
    return {
      id: 'oferta', pregunta: '¿Para qué oferta lo escribo?', libre: false,
      opciones: [...p.ofertas.slice(0, TOPE_OFERTAS).map((o) => ({ valor: `oferta:${o.id}`, texto: o.nombre })), { valor: AL_NEGOCIO, texto: 'Para mi negocio en general' }],
    };
  }
  const falta = faltaPorPreguntar(p, r);
  if (falta.length) {
    const o = ofertaElegida(p, r)!;
    const primera = falta.length === LO_MINIMO_REPLICA.filter((c) => o.falta.includes(c)).length;
    return {
      id: `${FALTA}${falta[0]}`, libre: true,
      pregunta: `${primera ? `A «${o.nombre}» le faltan datos para escribir sin inventar. ` : ''}${PREGUNTA_DATO[falta[0]]}`,
      opciones: [{ valor: SEGUIR_SIN, texto: 'Seguir sin eso' }, { valor: EN_OFFER, texto: 'Completarla en Offer' }],
    };
  }
  if (!p.tema.relacionado && !('tema' in r)) {
    const de = p.tema.original ? `El original habla de ${p.tema.original.nombre}` : 'El original habla de otra cosa';
    return {
      id: 'tema', libre: false,
      pregunta: `${de}, que no tiene que ver con lo tuyo${p.tema.negocio ? ` (${p.tema.negocio.nombre})` : ''}. ¿Cómo lo uso?`,
      opciones: [{ valor: SOLO_ESTRUCTURA, texto: 'Sólo su gancho y su estructura' }, { valor: LLEVAR_TEMA, texto: 'Llevar su idea a mi negocio' }],
    };
  }
  return null;
}

/** La respuesta a una pregunta de la réplica, ya guardada: «Seguir sin eso» cierra TODAS las de datos. */
export function responderReplica(paso: PasoIniciativa, valor: string, r: RespuestasIniciativa): RespuestasIniciativa {
  if (paso.id.startsWith(FALTA) && valor === SEGUIR_SIN) return { ...r, faltas: SEGUIR_SIN };
  return { ...r, [paso.id]: valor };
}

/** El nombre de una oferta elegida (`oferta:<id>`), o null (el negocio, o una que ya no está). */
export function nombreDeOferta(valor: string, ofertas: readonly OfertaCorta[]): string | null {
  const id = valor.startsWith('oferta:') ? Number(valor.slice('oferta:'.length)) : NaN;
  return Number.isFinite(id) ? ofertas.find((o) => o.id === id)?.nombre ?? null : null;
}

/**
 * La oferta con que MaKo escribe una réplica SIN preguntar: la principal (`listarOfertas` la pone primera), o el negocio.
 * 11/11/2026, Martín: la pregunta «¿Lo replico para tu oferta? ¿Para cuál?» frenaba el cuerpo; ahora la página queda escrita y
 * la oferta se cambia después (`otrasOfertasDeReplica`).
 */
export const ofertaDeReplica = (ofertas: readonly OfertaCorta[]): string => (ofertas.length ? `oferta:${ofertas[0].id}` : AL_NEGOCIO);

/** Para «¿La rehago para otra oferta?» debajo de la réplica escrita: las demás, como botones. */
export function otrasOfertasDeReplica(usada: string, ofertas: readonly OfertaCorta[]): { valor: string; texto: string }[] {
  return ofertas.slice(0, TOPE_OFERTAS).map((o) => ({ valor: `oferta:${o.id}`, texto: o.nombre })).filter((o) => o.valor !== usada);
}
