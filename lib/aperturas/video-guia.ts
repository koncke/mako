// =============================================================================
// La plantilla guiada de la tab Video: lo que MaKo pide en cada paso (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «al seleccionar un template tiene que quedar claro qué hacer… que MaKo le vaya dando los pasos: crearse un
// personaje, subir una foto, subir un audio… pásame una foto o selecciona de estas», con el resto de la pantalla opacado y el
// mensaje de MaKo marcado. El diseño: docs/relevo/nube-tab-video.md §4. La plantilla (los bloques, las piezas, los pasos):
// lib/video-plantillas/mensaje-para.ts.
//
// Es una SUPERFICIE de las aperturas (./reglas.ts): la arma el código, sin IA, un paso por vez, y la primera pregunta de cada
// paso es de hecho. Lo elegido no vive en la memoria de las aperturas (ésa sólo calla lo ya contestado): lo guarda el PROYECTO
// (app/video-editor/guia/estado.ts), y la pantalla pasa como hechos lo que el proyecto ya tiene. Cada paso tiene su id; un paso
// contestado no vuelve, y el siguiente es otra clave.
//
// Los pasos 7 en adelante (tomas blancas, montaje, entrega) todavía no los hace MaKo sola: después de los clips calla (null),
// nunca promete lo que no hace (docs/relevo/nube-tab-video.md §8).
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
  guionListo: boolean;
  /** El personaje elegido (`foto:<id>` o `personaje:<id>`), o null. */
  personaje: string | null;
  voz: string | null;
  fondo: string | null;
  /** Las fotos que ya subió y sus personajes aprobados: las opciones del paso del personaje. */
  fotos: readonly { id: string; url: string }[];
  personajes: readonly { id: string; url: string; nombre: string }[];
  /** ¿Tiene su voz clonada? null = todavía no se sabe (no se pregunta a ciegas). */
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

/** Lo que se contesta en cada paso (los valores que el proyecto guarda). */
export const VALOR = { vista: 'vista', vozClonada: 'clonada', sinVoz: 'sin-voz', corcho: 'corcho', otroLugar: 'otro' } as const;

/** El id del proyecto como entra en la clave de la memoria (`[A-Za-z0-9_-]`, 60 como mucho). */
const entidadDe = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);

/** Las opciones del paso del personaje: primero sus personajes aprobados, después sus fotos; hasta `TOPE_GALERIA`. */
export function opcionesDePersonaje(h: Pick<HechosVideoGuia, 'fotos' | 'personajes'>): OpcionGaleria[] {
  const out: OpcionGaleria[] = [];
  h.personajes.forEach((p, i) => out.push({ valor: `personaje:${p.id}`, imagen: p.url, rotulo: p.nombre.slice(0, 28) || `Personaje ${i + 1}` }));
  h.fotos.forEach((f, i) => out.push({ valor: `foto:${f.id}`, imagen: f.url, rotulo: `Foto ${i + 1}` }));
  return out.filter((o) => /^(https:\/\/|\/)/.test(o.imagen)).slice(0, TOPE_GALERIA);
}

/** El paso de ahora: el primero que falta, con lo contestado en esta visita (`r`) sumado a lo que el proyecto ya tiene. */
export function aperturaVideoGuia(h: HechosVideoGuia, r: Respuestas): Apertura<AccionVideoGuia> | null {
  if (!h.proyecto || !entidadDe(h.proyecto) || h.plantilla !== PLANTILLA_MENSAJE_PARA.id || h.ocupado) return null;
  const entidad = entidadDe(h.proyecto);
  const base = { alcance: 'entidad' as const, entidad };
  const ref = PLANTILLA_MENSAJE_PARA.referencia;

  if (!h.vioReferencia && !r[PASO.referencia]) {
    return {
      ...base, id: PASO.referencia,
      texto: `Este video copia el reel de ${ref.creador.nombre}: 6 bloques en 30 s, y tú pones tu mensaje. ¿Ya lo viste?`,
      botones: [
        { tipo: 'hacer', rotulo: 'Ver el original', accion: 'ver-referencia' },
        { tipo: 'respuesta', rotulo: 'Ya lo vi', valor: VALOR.vista },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }

  if (!h.guionListo) {
    return {
      ...base, id: PASO.guion,
      texto: 'Tu guion va en 6 bloques: a quién le hablas, quién eres, qué creaste, qué gana y qué pides. ¿Ya lo tienes escrito?',
      botones: [
        { tipo: 'hacer', rotulo: 'Escribir mi guion', accion: 'guion' },
        { tipo: 'callar', rotulo: 'Lo escribo yo' },
      ],
    };
  }

  if (!h.personaje && !r[PASO.personaje]) {
    const galeria = opcionesDePersonaje(h);
    return {
      ...base, id: PASO.personaje,
      texto: galeria.length
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

  if (!h.voz && !r[PASO.voz]) {
    if (h.vozClonada == null) return null;
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
  }

  if (!h.fondo && !r[PASO.fondo]) {
    return {
      ...base, id: PASO.fondo,
      texto: 'El fondo se arma solo, sin ti, y después entras tú. ¿Dónde vas a estar?',
      botones: [
        { tipo: 'respuesta', rotulo: 'Corcho con fotos', valor: VALOR.corcho },
        { tipo: 'respuesta', rotulo: 'Otro lugar', valor: VALOR.otroLugar },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }

  if (h.guion && !r[PASO.clips]) {
    const clips = clipsDelGuion(h.guion).filter((c) => c.texto);
    const segundos = clips.reduce((s, c) => s + c.duracion.segundos, 0);
    const creditos = clips.reduce((s, c) => s + c.duracion.creditos, 0);
    return {
      ...base, id: PASO.clips,
      texto: `Tus ${clips.length} clips suman ${segundos} s y ${creditos} créditos de Flow, y cada uno se filma después de tu OK a su imagen. ¿Tienes ese saldo?`,
      botones: [
        { tipo: 'hacer', rotulo: 'Ver cada clip', accion: 'ver-clips' },
        { tipo: 'callar', rotulo: 'Lo hago yo' },
      ],
    };
  }

  return null;
}

export const SUPERFICIE_VIDEO_GUIA: Superficie<HechosVideoGuia, AccionVideoGuia> = { id: ID_VIDEO_GUIA, acciones: ACCIONES_VIDEO_GUIA, apertura: aperturaVideoGuia };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: PASO.referencia, cuando: 'Un proyecto de «Mensaje para…» que todavía no vio el reel de origen.' },
  { id: PASO.guion, cuando: 'El guion de los 6 bloques no está completo.' },
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
  fotos: [], personajes: [], vozClonada: null, ocupado: false,
};
const LISTO_HASTA_VOZ: HechosVideoGuia = { ...BASE, vioReferencia: true, guion: GUION_COMPLETO, guionListo: true, personaje: 'foto:f1', fotos: [FOTO] };

export const EJEMPLOS: readonly { nombre: string; h: HechosVideoGuia; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'recién abierto', h: BASE, r: {}, espera: PASO.referencia, primerPaso: true },
  { nombre: 'vio la referencia en esta visita', h: BASE, r: { [PASO.referencia]: VALOR.vista }, espera: PASO.guion },
  { nombre: 'sin guion', h: { ...BASE, vioReferencia: true }, r: {}, espera: PASO.guion, primerPaso: true },
  { nombre: 'con guion y sin fotos', h: { ...BASE, vioReferencia: true, guion: GUION_COMPLETO, guionListo: true }, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'con guion y con una foto', h: { ...BASE, vioReferencia: true, guion: GUION_COMPLETO, guionListo: true, fotos: [FOTO] }, r: {}, espera: PASO.personaje, primerPaso: true },
  { nombre: 'sin saber si tiene voz', h: LISTO_HASTA_VOZ, r: {}, espera: null },
  { nombre: 'con su voz clonada', h: { ...LISTO_HASTA_VOZ, vozClonada: true }, r: {}, espera: PASO.voz, primerPaso: true },
  { nombre: 'sin voz clonada', h: { ...LISTO_HASTA_VOZ, vozClonada: false }, r: {}, espera: PASO.voz, primerPaso: true },
  { nombre: 'falta el fondo', h: { ...LISTO_HASTA_VOZ, vozClonada: true, voz: VALOR.vozClonada }, r: {}, espera: PASO.fondo, primerPaso: true },
  { nombre: 'listo para filmar', h: { ...LISTO_HASTA_VOZ, vozClonada: true, voz: VALOR.vozClonada, fondo: VALOR.corcho }, r: {}, espera: PASO.clips, primerPaso: true },
  { nombre: 'ya vio los clips', h: { ...LISTO_HASTA_VOZ, vozClonada: true, voz: VALOR.vozClonada, fondo: VALOR.corcho }, r: { [PASO.clips]: 'visto' }, espera: null },
  { nombre: 'un proyecto sin plantilla', h: { ...BASE, plantilla: null }, r: {}, espera: null },
  { nombre: 'MaKo trabajando', h: { ...BASE, ocupado: true }, r: {}, espera: null },
  { nombre: 'sin proyecto', h: { ...BASE, proyecto: null }, r: {}, espera: null },
];
