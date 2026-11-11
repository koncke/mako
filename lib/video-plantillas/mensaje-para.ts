// =============================================================================
// La plantilla «Mensaje para…»: la estructura del reel de Josep que MaKo guía paso a paso (PURO; 9/11/2026)
// =============================================================================
// El primer reel hecho entero copiando uno que funciona (el de Josep Casas / Tacho, instagram.com/reel/DdTdIIPDzHU). El proceso
// de punta a punta, los scripts y las mediciones: docs/plantillas-video/mensaje-para/PROCESO.md; las reglas del template y su
// checklist: docs/manual-video-mako.md §7.1; la gramática del corte: docs/hallazgos-video-editor.md → «Cortar al ritmo de una
// referencia». Martín, 9/11: «No quiero que sea difícil para el usuario visualizarlo… que MaKo le vaya dando los pasos».
//
// Acá viven los DATOS de la plantilla: los 6 bloques con los tiempos medidos de Josep, las piezas que usa, sus reglas extra, y
// los pasos que lleva MaKo (cada uno con su pieza, si gasta créditos y los agentes que lo hacen en el montaje). Lo que MaKo DICE
// en cada paso lo arma lib/aperturas/video-guia.ts con estos datos.
//
// ⚠️ LA ESTRUCTURA NO SE TOCA: el usuario pone su texto en cada bloque; el orden, la cantidad de bloques y los golpes son los de
// la referencia (manual §7.1, regla 11: «el guion del cliente es textual»; y la estructura es la de Josep).
// =============================================================================

import { duracionDeClip, type DuracionClip } from './medidas';
import type { IdPieza } from './piezas';

export const ID_MENSAJE_PARA = 'mensaje-para';

export type IdBloque = 'disparo' | 'credencial' | 'producto' | 'beneficio' | 'remate' | 'cierre';

export type BloqueGuion = {
  id: IdBloque;
  nombre: string;
  /** Desde y hasta, en segundos, en el reel de Josep (30,8 s, 16 tomas; medido el 9/11). */
  tiempo: readonly [number, number];
  /** Qué hace el bloque, en una frase (lo que lee la persona al escribirlo). */
  que: string;
  /** El molde de la frase, con huecos («___»): nunca el texto de un cliente. */
  molde: string;
  /** El personaje hace algo mientras habla (baja el ritmo: lib/video-plantillas/medidas.ts). */
  gesto: boolean;
  /** Sin voz: el cierre de ~10 s con los carteles. */
  mudo?: true;
};

/** Los 6 bloques, en el orden de la referencia (manual §7.1, «La estructura»). */
export const BLOQUES: readonly BloqueGuion[] = [
  { id: 'disparo', nombre: 'Disparo', tiempo: [0, 3], que: 'Nombra a quién le hablas y lo pincha.', molde: 'Este es un mensaje para todos los ___.', gesto: true },
  { id: 'credencial', nombre: 'Credencial', tiempo: [3.5, 8.6], que: 'Tu nombre y por qué te van a creer.', molde: 'Me llamo ___, tengo ___ y ___.', gesto: false },
  { id: 'producto', nombre: 'El producto', tiempo: [9.5, 12.6], que: 'Lo que creaste, como consecuencia: se deduce, no se presenta.', molde: 'Por eso creé ___ para que ___.', gesto: false },
  { id: 'beneficio', nombre: 'Beneficio', tiempo: [13, 16.5], que: 'Lo que gana quien te escucha.', molde: 'Vas a poder ___.', gesto: false },
  { id: 'remate', nombre: 'Remate', tiempo: [17, 20.6], que: 'Vuelve al pinchazo del principio y pide algo.', molde: 'Deja de ___. Mejor comenta «___» y ___.', gesto: false },
  { id: 'cierre', nombre: 'Cierre sin voz', tiempo: [20.6, 30.8], que: 'Unos 10 s sin voz: lo que pides y tu oferta, en carteles.', molde: '', gesto: false, mudo: true },
];

/** Los 5 golpes de la canción en lo hablado, uno al CERRAR cada bloque (Josep: «disparo, nombre, credencial, producto,
 *  beneficio»; el nombre es la primera mitad de la credencial). Ninguno adentro de un bloque ni en el remate (manual §8.3). */
export const GOLPES = ['disparo', 'nombre', 'credencial', 'producto', 'beneficio'] as const;

/** Lo medido de la referencia que el montaje copia (docs/hallazgos-video-editor.md, «Cortar al ritmo»). */
export const RITMO_REFERENCIA = {
  bpm: 130.95,
  beatS: 0.458,
  /** Un inserto corto dura 1,3 beats; el largo, 2,1 (en la primera mitad, flashes; al final, más largos). */
  insertoCortoS: 0.596,
  insertoLargoS: 1.0,
  /** Ningún tramo hablado pasa de 3,6 s; ningún hueco sin voz ni música pasa de 0,52 s. */
  tramoMaxS: 3.6,
  huecoMaxS: 0.52,
  /** La voz se acelera con `atempo` (conserva el tono); `asetrate` la sube un 9,7 %. */
  aceleracionVoz: 1.1,
  /** La música suena ~4,5 LU por encima de la voz en el cierre; la mezcla termina en −14 LUFS. */
  lufs: -14,
  duracionS: 30.8,
  lienzo: { ancho: 1080, alto: 1920 },
} as const;

/** Las reglas extra del template, en una línea cada una (manual §7.1). Lo que MaKo revisa antes de mostrar el montaje. */
export const REGLAS: readonly string[] = [
  'Dos mundos que se alternan: tú delante del fondo y la toma blanca a contraluz.',
  'En la primera mitad nunca van dos tomas seguidas del mismo mundo.',
  'Una sola palabra roja por toma blanca, y como mucho tres en lo hablado.',
  'Subtítulos de 2 a 3 palabras, debajo del mentón.',
  'La música no va debajo de la voz: entra como golpe al cerrar cada bloque.',
  'El mismo fondo en todo el video, y cada clip sale del personaje original.',
  'Se entrega con la canción y sin ella, para ponerla desde Instagram.',
];

export type IdPaso = 'referencia' | 'guion' | 'personaje' | 'voz' | 'fondo' | 'clips' | 'tomas' | 'montaje' | 'entrega';

export type PasoPlantilla = {
  id: IdPaso;
  nombre: string;
  pieza: IdPieza | null;
  /** Gasta créditos: sólo con el OK del usuario a la imagen (manual §3, regla 7). */
  gasta: boolean;
  /** Los agentes del montaje que lo hacen con sus cursores (tanda 2: app/video-editor/_opencut/enjambre/). */
  agentes: readonly string[];
};

/** Los pasos que lleva MaKo, en orden (PROCESO.md, «Los pasos»). */
export const PASOS: readonly PasoPlantilla[] = [
  { id: 'referencia', nombre: 'La referencia', pieza: null, gasta: false, agentes: [] },
  { id: 'guion', nombre: 'Tu guion', pieza: null, gasta: false, agentes: ['guion-01'] },
  { id: 'personaje', nombre: 'Tu personaje', pieza: 'personaje', gasta: false, agentes: [] },
  { id: 'voz', nombre: 'Tu voz', pieza: 'voz', gasta: false, agentes: ['voz-01'] },
  { id: 'fondo', nombre: 'El fondo', pieza: 'fondo', gasta: false, agentes: [] },
  { id: 'clips', nombre: 'Los clips', pieza: 'clip-hablado', gasta: true, agentes: ['clip-01'] },
  { id: 'tomas', nombre: 'Las tomas blancas', pieza: 'toma-blanca', gasta: true, agentes: ['inserto-01'] },
  { id: 'montaje', nombre: 'El montaje', pieza: null, gasta: false, agentes: ['corte-01', 'golpes-01', 'subs-01', 'efecto-01', 'cierre-01'] },
  { id: 'entrega', nombre: 'La entrega', pieza: null, gasta: false, agentes: [] },
];

export const PIEZAS_MENSAJE_PARA: readonly IdPieza[] = ['personaje', 'fondo', 'clip-hablado', 'voz', 'toma-blanca', 'musica', 'subtitulos', 'efecto', 'cartel'];

/** El guion que escribe la persona: un texto por bloque hablado y, en el cierre, el pedido y la oferta. */
export type GuionMensajePara = Partial<Record<Exclude<IdBloque, 'cierre'>, string>> & { cta?: string; oferta?: string };

export const BLOQUES_HABLADOS = BLOQUES.filter((b) => !b.mudo);

/** El guion está completo: los 5 bloques hablados con texto, y el pedido del cierre. */
export function guionCompleto(g: GuionMensajePara | null | undefined): boolean {
  if (!g) return false;
  return BLOQUES_HABLADOS.every((b) => (g[b.id as Exclude<IdBloque, 'cierre'>] ?? '').trim().length > 0) && (g.cta ?? '').trim().length > 0;
}

export type ClipDelGuion = { bloque: IdBloque; nombre: string; texto: string; duracion: DuracionClip };

/** Un clip por bloque hablado, con lo que dura (y cuesta) según sus palabras. */
export function clipsDelGuion(g: GuionMensajePara): ClipDelGuion[] {
  return BLOQUES_HABLADOS.map((b) => {
    const texto = (g[b.id as Exclude<IdBloque, 'cierre'>] ?? '').trim();
    return { bloque: b.id, nombre: b.nombre, texto, duracion: duracionDeClip(texto, { gesto: b.gesto }) };
  });
}

/** Cuántos créditos de video lleva el guion entero (sólo los clips con texto). */
export function creditosDelGuion(g: GuionMensajePara): number {
  return clipsDelGuion(g).reduce((s, c) => s + (c.texto ? c.duracion.creditos : 0), 0);
}

/** Lo que el guion tiene mal ANTES de filmar, en palabras (vacío = se puede filmar). */
export function problemasDelGuion(g: GuionMensajePara): string[] {
  const out: string[] = [];
  for (const c of clipsDelGuion(g)) {
    if (!c.texto) out.push(`Falta el bloque «${c.nombre}».`);
    else if (c.duracion.partir) out.push(`«${c.nombre}» no entra en 10 s: pártelo en dos frases.`);
  }
  if (!(g.cta ?? '').trim()) out.push('Falta lo que pides al final (el cartel del cierre).');
  return out;
}

/** La plantilla, como la nombran la portada, «Nuevo video» y la API. */
export const PLANTILLA_MENSAJE_PARA = {
  id: ID_MENSAJE_PARA,
  nombre: 'Mensaje para…',
  descripcion: 'Le hablas a tu cliente ideal en 30 s: lo pinchas, dices quién eres y qué creaste, y cierras con una oferta.',
  duracionS: 30,
  referencia: {
    creador: { nombre: 'Josep Casas', usuario: 'soyjosepcasas' },
    url: 'https://www.instagram.com/reel/DdTdIIPDzHU/',
    // Su portada de Instagram (la de los pistachos), servida por nosotros: la de su CDN vence a las horas (11/11/2026, Martín:
    // «ni siquiera se ve la miniatura»).
    miniatura: '/video/plantillas/mensaje-para.jpg',
    red: 'instagram' as const,
    formato: 'reel' as const,
  },
  bloques: BLOQUES,
  pasos: PASOS,
  piezas: PIEZAS_MENSAJE_PARA,
  reglas: REGLAS,
} as const;
