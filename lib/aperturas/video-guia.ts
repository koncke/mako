// =============================================================================
// La plantilla guiada de la tab Video: lo que MaKo pide en cada paso (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «al seleccionar un template tiene que quedar claro qué hacer… que MaKo le vaya dando los pasos: crearse un
// personaje, subir una foto, subir un audio… pásame una foto o selecciona de estas», con el resto de la pantalla opacado y el
// mensaje de MaKo marcado. El diseño: docs/relevo/nube-tab-video.md §4. La plantilla (los bloques, las piezas, los pasos):
// lib/video-plantillas/mensaje-para.ts.
//
// Es una SUPERFICIE de las aperturas (./reglas.ts): la arma el código, sin IA, un paso por vez, y la primera pregunta de cada
// paso es de hecho. Con una diferencia que la revisión del 9/11 obligó a escribir: **su memoria es el PROYECTO, no la de las
// aperturas**. La de las aperturas calla una clave («Ahora no» 14 días, tres vistas sin respuesta 14 días, el segundo «Ahora
// no» para siempre) y, como la guía devuelve sólo el primer paso que falta, callar ESE paso callaba la guía entera. Lo
// contestado y lo salteado se guardan en el proyecto (app/video-editor/guia/estado.ts) y vuelven acá como hechos: un paso
// salteado se saltea y sigue el siguiente; se retoma desde la lista de pasos (`pasosDeLaGuia`, la que dibuja el chat).
//
// Los pasos 7 en adelante (tomas blancas, montaje, entrega) todavía no los hace MaKo sola: después de los clips la lista lo dice
// en una línea (`LINEA_FINAL`), nunca promete (docs/relevo/nube-tab-video.md §8).
// =============================================================================

import type { Apertura, OpcionGaleria, Respuestas, Superficie } from './reglas';
import { TOPE_GALERIA } from './reglas';
import { PLANTILLA_MENSAJE_PARA, clipsDelGuion, type GuionMensajePara } from '../video-plantillas/mensaje-para';

export const ACCIONES_VIDEO_GUIA = ['ver-referencia', 'guion', 'subir-foto', 'grabar-voz', 'ver-clips'] as const;
export type AccionVideoGuia = (typeof ACCIONES_VIDEO_GUIA)[number];

export type HechosVideoGuia = {
  /** El proyecto abierto (su id). null = no hay proyecto. */
  proyecto: string | null;
  /** La plantilla guiada del proyecto (lib/video-plantillas/). null = el proyecto no es de plantilla: MaKo no guía. */
  plantilla: string | null;
  /** Lo que el proyecto ya tiene. */
  vioReferencia: boolean;
  guion: GuionMensajePara | null;
  /** Completo Y filmable: los 5 bloques, el pedido del cierre, y ningún bloque que no entre en 10 s. */
  guionListo: boolean;
  /** El personaje elegido (`foto:<id>` o `personaje:<id>`), o null. */
  personaje: string | null;
  voz: string | null;
  fondo: string | null;
  /** Lo contestado del último paso (`alcanzan`, `visto`), o null. */
  clips: string | null;
  /** Los pasos que la persona salteó EN ESTE PROYECTO (los ids de `PASO`): se saltean, y la lista deja retomarlos. */
  saltados: readonly string[];
  /** Las fotos que ya subió y sus personajes aprobados: las opciones del paso del personaje. */
  fotos: readonly { id: string; url: string }[];
  personajes: readonly { id: string; url: string; nombre: string }[];
  /** ¿Se pudieron leer sus fotos? false = «no pude leer» (no es «no tiene»: se dice distinto). */
  fotosLeidas: boolean;
  /**
   * ¿Tiene su voz clonada? null = no se pudo saber: el paso de la voz se SALTEA (no se pregunta a ciegas) y MaKo sigue con el
   * fondo. Saltearlo y no callar: con la voz sin leer, la guía entera se quedaba muda en ese paso para siempre.
   */
  vozClonada: boolean | null;
  /** MaKo está trabajando o hay algo en el chat: el paso espera. */
  ocupado: boolean;
};

export const ID_VIDEO_GUIA = 'video-guia';
export const PASO = {
  referencia: 'video-guia:referencia',
  guion: 'video-guia:guion',
  personaje: 'video-guia:personaje',
  voz: 'video-guia:voz',
  fondo: 'video-guia:fondo',
  clips: 'video-guia:clips',
} as const;

/** Lo que se contesta en cada paso (los valores que el proyecto guarda). `saltado`: lo que deja un botón de callar. */
export const VALOR = {
  vista: 'vista', vozClonada: 'clonada', sinVoz: 'sin-voz', corcho: 'corcho', otroLugar: 'otro', alcanzan: 'alcanzan', visto: 'visto',
  saltado: 'saltado',
} as const;

/** El id del proyecto como entra en la clave (`[A-Za-z0-9_-]`, 60 como mucho). */
const entidadDe = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);

/** Las opciones del paso del personaje: primero sus personajes aprobados, después sus fotos; hasta `TOPE_GALERIA`. */
export function opcionesDePersonaje(h: Pick<HechosVideoGuia, 'fotos' | 'personajes'>): OpcionGaleria[] {
  const out: OpcionGaleria[] = [];
  h.personajes.forEach((p, i) => out.push({ valor: `personaje:${p.id}`, imagen: p.url, rotulo: p.nombre.slice(0, 28) || `Personaje ${i + 1}` }));
  h.fotos.forEach((f, i) => out.push({ valor: `foto:${f.id}`, imagen: f.url, rotulo: `Foto ${i + 1}` }));
  return out.filter((o) => /^(https:\/\/|\/)/.test(o.imagen)).slice(0, TOPE_GALERIA);
}

export type EstadoPaso = 'listo' | 'saltado' | 'pendiente';
export type PasoDeLaGuia = { id: string; nombre: string; estado: EstadoPaso };

/** Los pasos que MaKo pregunta, en orden, y cuándo cada uno está listo. La voz sin leer no es un paso (no se pregunta a ciegas). */
function pasosConHecho(h: HechosVideoGuia): { id: string; nombre: string; listo: boolean }[] {
  return [
    { id: PASO.referencia, nombre: 'Ver la referencia', listo: h.vioReferencia },
    { id: PASO.guion, nombre: 'Tu guion', listo: h.guionListo },
    { id: PASO.personaje, nombre: 'Tu personaje', listo: !!h.personaje },
    ...(h.vozClonada == null ? [] : [{ id: PASO.voz, nombre: 'Tu voz', listo: !!h.voz }]),
    { id: PASO.fondo, nombre: 'El fondo', listo: !!h.fondo },
    { id: PASO.clips, nombre: 'Los clips', listo: !!h.clips },
  ];
}

/** La lista de pasos con su estado: lo que el chat dibuja cuando MaKo no está preguntando (para retomar lo salteado). */
export function pasosDeLaGuia(h: HechosVideoGuia): PasoDeLaGuia[] {
  return pasosConHecho(h).map((p) => ({ id: p.id, nombre: p.nombre, estado: p.listo ? 'listo' : h.saltados.includes(p.id) ? 'saltado' : 'pendiente' }));
}

/** El paso de ahora: el primero que falta y no se salteó, con lo contestado en esta visita (`r`) sumado al proyecto. */
export function aperturaVideoGuia(h: HechosVideoGuia, r: Respuestas): Apertura<AccionVideoGuia> | null {
  if (!h.proyecto || !entidadDe(h.proyecto) || h.plantilla !== PLANTILLA_MENSAJE_PARA.id || h.ocupado) return null;
  const base = { alcance: 'entidad' as const, entidad: entidadDe(h.proyecto) };
  const ref = PLANTILLA_MENSAJE_PARA.referencia;
  const siguiente = pasosConHecho(h).find((p) => !p.listo && !h.saltados.includes(p.id) && !r[p.id]);
  if (!siguiente) return null;

  switch (siguiente.id) {
    case PASO.referencia:
      return {
        ...base, id: PASO.referencia,
        texto: `Este video copia el reel de ${ref.creador.nombre}: 6 bloques en 30 s, y tú pones tu mensaje. ¿Ya lo viste?`,
        botones: [
          { tipo: 'hacer', rotulo: 'Ver el original', accion: 'ver-referencia' },
          { tipo: 'respuesta', rotulo: 'Ya lo vi', valor: VALOR.vista },
          { tipo: 'callar', rotulo: 'Ahora no' },
        ],
      };
    case PASO.guion:
      return {
        ...base, id: PASO.guion,
        texto: 'Tu guion va en 6 bloques: a quién le hablas, quién eres, qué creaste, qué gana, qué pides y un cierre sin voz. ¿Ya lo tienes?',
        botones: [
          { tipo: 'hacer', rotulo: 'Escribir mi guion', accion: 'guion' },
          { tipo: 'callar', rotulo: 'Lo escribo yo' },
        ],
      };
    case PASO.personaje: {
      const galeria = opcionesDePersonaje(h);
      return {
        ...base, id: PASO.personaje,
        texto: !h.fotosLeidas
          ? 'No pude leer tus fotos. Tu personaje sale de una foto tuya de frente, con luz de día. ¿La tienes a mano?'
          : galeria.length
            ? 'Tu personaje sale de una foto tuya de frente, con luz de día. ¿Cuál uso?'
            : 'Tu personaje sale de una foto tuya de frente, con luz de día. ¿Tienes una a mano?',
        ...(galeria.length ? { galeria } : {}),
        botones: [
          { tipo: 'hacer', rotulo: 'Subir una foto', accion: 'subir-foto' },
          { tipo: 'ir', rotulo: 'Crear mi personaje', href: '/ai-avatar' },
          { tipo: 'callar', rotulo: 'Ahora no' },
        ],
      };
    }
    case PASO.voz:
      return h.vozClonada
        ? {
          ...base, id: PASO.voz,
          texto: 'Ya tienes tu voz clonada. ¿Es la que va en este video?',
          botones: [
            { tipo: 'respuesta', rotulo: 'Sí, mi voz', valor: VALOR.vozClonada },
            { tipo: 'hacer', rotulo: 'Grabarla de nuevo', accion: 'grabar-voz' },
            { tipo: 'callar', rotulo: 'Ahora no' },
          ],
        }
        : {
          ...base, id: PASO.voz,
          texto: 'Tu video va con tu voz: se pasa sobre la de cada clip. ¿Ya la grabaste?',
          botones: [
            { tipo: 'hacer', rotulo: 'Grabarla ahora', accion: 'grabar-voz' },
            { tipo: 'respuesta', rotulo: 'Sin mi voz por ahora', valor: VALOR.sinVoz },
            { tipo: 'callar', rotulo: 'Ahora no' },
          ],
        };
    case PASO.fondo:
      return {
        ...base, id: PASO.fondo,
        texto: 'El fondo se arma solo, sin ti, y después entras tú. ¿Dónde vas a estar?',
        botones: [
          { tipo: 'respuesta', rotulo: 'Corcho con fotos', valor: VALOR.corcho },
          { tipo: 'respuesta', rotulo: 'Otro lugar', valor: VALOR.otroLugar },
          { tipo: 'callar', rotulo: 'Ahora no' },
        ],
      };
    case PASO.clips: {
      // Sin el guion listo no hay qué sumar: el paso espera al guion (que se retoma desde la lista).
      if (!h.guion || !h.guionListo) return null;
      const clips = clipsDelGuion(h.guion).filter((c) => c.texto);
      const segundos = clips.reduce((s, c) => s + c.duracion.segundos, 0);
      const creditos = clips.reduce((s, c) => s + c.duracion.creditos, 0);
      return {
        ...base, id: PASO.clips,
        texto: `Tus ${clips.length} clips suman ${segundos} s y ${creditos} créditos de Flow, y cada uno se filma después de tu OK a su imagen. ¿Te alcanzan?`,
        botones: [
          { tipo: 'respuesta', rotulo: 'Sí, me alcanzan', valor: VALOR.alcanzan },
          { tipo: 'hacer', rotulo: 'Ver cada clip', accion: 'ver-clips' },
          { tipo: 'callar', rotulo: 'Lo hago yo' },
        ],
      };
    }
    default:
      return null;
  }
}

/** Lo que dice la lista de pasos cuando MaKo ya no tiene qué preguntar: el paso que sigue, que hoy se hace en otra pantalla. */
export const LINEA_FINAL = 'Para filmar cada clip con tu personaje, ábrelo en «Tu personaje con IA».';

export const SUPERFICIE_VIDEO_GUIA: Superficie<HechosVideoGuia, AccionVideoGuia> = { id: ID_VIDEO_GUIA, acciones: ACCIONES_VIDEO_GUIA, apertura: aperturaVideoGuia };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: PASO.referencia, cuando: 'Un proyecto de «Mensaje para…» que todavía no vio el reel de origen.' },
  { id: PASO.guion, cuando: 'El guion de los 6 bloques no está completo o tiene un bloque que no entra en 10 s.' },
  { id: PASO.personaje, cuando: 'Falta el personaje: sus fotos y sus personajes aprobados, cliqueables.' },
  { id: PASO.voz, cuando: 'Falta la voz: la clonada, grabarla o seguir sin ella.' },
  { id: PASO.fondo, cuando: 'Falta el fondo.' },
  { id: PASO.clips, cuando: 'Todo listo para filmar: cuántos segundos y créditos suman los clips.' },
];

const GUION_COMPLETO: GuionMensajePara = {
  disparo: 'Este es un mensaje para todos los que venden cursos sin resultados.',
  credencial: 'Me llamo Valeria, tengo diez años en ventas y probé de todo.',
  producto: 'Por eso creé un método para que vendas sin perseguir a nadie.',
  beneficio: 'Vas a poder cerrar ventas desde tu celular en minutos.',
  remate: 'Deja de pagar mentorías vacías. Mejor comenta «Método» y te lo regalo.',
  cta: 'Comenta «Método»',
  oferta: 'Una semana gratis',
};
const FOTO = { id: 'f1', url: 'https://ejemplo.supabase.co/storage/v1/object/sign/archivero/f1.jpg' };
const BASE: HechosVideoGuia = {
  proyecto: 'p-7f3a', plantilla: 'mensaje-para', vioReferencia: false, guion: null, guionListo: false, personaje: null, voz: null, fondo: null,
  clips: null, saltados: [], fotos: [], personajes: [], fotosLeidas: true, vozClonada: null, ocupado: false,
};
const CON_GUION: HechosVideoGuia = { ...BASE, vioReferencia: true, guion: GUION_COMPLETO, guionListo: true };
const LISTO_HASTA_VOZ: HechosVideoGuia = { ...CON_GUION, personaje: 'foto:f1', fotos: [FOTO] };
const LISTO_PARA_FILMAR: HechosVideoGuia = { ...LISTO_HASTA_VOZ, vozClonada: true, voz: VALOR.vozClonada, fondo: VALOR.corcho };

export const EJEMPLOS: readonly { nombre: string; h: HechosVideoGuia; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'recién abierto', h: BASE, r: {}, espera: PASO.referencia, primerPaso: true },
  { nombre: 'vio la referencia en esta visita', h: BASE, r: { [PASO.referencia]: VALOR.vista }, espera: PASO.guion },
  { nombre: 'sin guion', h: { ...BASE, vioReferencia: true }, r: {}, espera: PASO.guion, primerPaso: true },
  { nombre: 'salteó el guion: sigue el personaje', h: { ...BASE, vioReferencia: true, saltados: [PASO.guion] }, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'con guion y sin fotos', h: CON_GUION, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'con guion y con una foto', h: { ...CON_GUION, fotos: [FOTO] }, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'sin poder leer sus fotos', h: { ...CON_GUION, fotosLeidas: false }, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'sin saber si tiene voz: se saltea, sigue el fondo', h: LISTO_HASTA_VOZ, r: {}, espera: PASO.fondo, primerPaso: true },
  { nombre: 'con su voz clonada', h: { ...LISTO_HASTA_VOZ, vozClonada: true }, r: {}, espera: PASO.voz, primerPaso: true },
  { nombre: 'sin voz clonada', h: { ...LISTO_HASTA_VOZ, vozClonada: false }, r: {}, espera: PASO.voz, primerPaso: true },
  { nombre: 'listo para filmar', h: LISTO_PARA_FILMAR, r: {}, espera: PASO.clips, primerPaso: true },
  { nombre: 'contestó los clips', h: { ...LISTO_PARA_FILMAR, clips: VALOR.alcanzan }, r: {}, espera: null },
  { nombre: 'salteó lo demás y falta el guion: los clips esperan al guion', h: { ...BASE, vioReferencia: true, saltados: [PASO.guion, PASO.personaje, PASO.fondo] }, r: {}, espera: null },
  { nombre: 'un proyecto sin plantilla', h: { ...BASE, plantilla: null }, r: {}, espera: null },
  { nombre: 'MaKo trabajando', h: { ...BASE, ocupado: true }, r: {}, espera: null },
  { nombre: 'sin proyecto', h: { ...BASE, proyecto: null }, r: {}, espera: null },
];
