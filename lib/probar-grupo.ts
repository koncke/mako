// =============================================================================
// probar-grupo — el grupo de WhatsApp de MaKo en «Probar» (16/10/2026)
// =============================================================================
// Martín (feedback del 16/10 por Cerebro, punto 3), textual: «En todas las automatizaciones de WhatsApp que haya un
// paso del grupo de WhatsApp de MaKo, debería salir como primer contacto, con el nombre real del grupo... Y al
// reproducir cada caso, MaKo debería enviar el mensaje correspondiente».
//
// Hasta ese día la tarjeta «MaKo en WhatsApp» pasaba por «Probar» como una pastilla («⚡ Avisar al equipo») y lo que le
// llegaba al grupo no se veía en ningún lado. Ahora el grupo es el PRIMER contacto de la lista (fijado arriba, como un
// chat fijado de WhatsApp), con el nombre que tiene en WhatsApp, y cada caso que pasa por la tarjeta le deja ahí su
// mensaje, con las mismas partes y los mismos datos de ejemplo que el resto de la prueba.
//
// ⚠️ AL GRUPO NO LE LLEGA NADA DE VERDAD CON «PROBAR EN WHATSAPP»: el grupo es el del cliente, con su equipo adentro (en
// el ws1, el de Mauricio). Una prueba que le escribe ahí es un aviso falso a gente real.
// ⚠️ SALVO UNA (17/10/2026, tarjeta #852; Martín en la revisión de esa tarde, 44:06): «que se envíen las pruebas al
// grupo, no solamente a los leads… si la automatización no tiene ningún mensaje a clientes, solamente tiene mensajes al
// grupo de MaKo… que se pueda probar en el grupo de MaKo». Una automatización que SÓLO le habla al grupo (`soloAlGrupo`)
// se prueba «en el grupo»: sin pedir remitente ni número (no hay a quién más mandarle), y cada mensaje llega con un
// encabezado que dice que es una prueba (`ENCABEZADO_PRUEBA`). Con un mensaje al lead, sigue como arriba.
//
// PURO: lo usan PanelProbar y tests/probar-grupo-mako.test.ts.
// =============================================================================

import { esTarjetaMako } from './nutricion-grafo-motor';
import { esNodoMensaje, esPasoIA } from './flujo-grafo';
import { esPorEmail, esTarjetaTalCual, partesDeMako, armarAvisoDeTarjeta } from './mako-tarjeta';
import type { ParteMensaje } from './mensaje-partes';
import type { PasoGrafo } from './flujo-grafo';

/** El id del contacto del grupo en la lista: no choca con el de un escenario (ésos salen de las condiciones). */
export const ID_GRUPO = '__grupo-mako';

/** Cómo se llama el grupo cuando no se pudo leer su nombre: «no pude leer» no es «se llama así». */
export const NOMBRE_GRUPO_SIN_LEER = 'Grupo de MaKo';
/** En SuperAdmin la tarjeta le escribe al grupo del negocio que emitió el evento: no hay UN nombre. */
export const NOMBRE_GRUPO_DE_CADA_NEGOCIO = 'Grupo de cada negocio';
/** El renglón del contacto cuando el negocio todavía no tiene grupo. */
export const SIN_GRUPO_TODAVIA = 'Sin grupo todavía';

/** La pastilla que queda en el chat del lead cuando el caso pasa por la tarjeta. */
export const PILDORA_AL_GRUPO = '📣 MaKo le escribió al grupo';
/** El primer renglón del chat del grupo en la prueba: que nadie crea que le llegó al equipo. */
export const NOTA_DEL_GRUPO = 'Prueba: al grupo no le llega nada';
/** El renglón del contacto antes de que algún caso pase por la tarjeta. */
export const GRUPO_SIN_MENSAJES = 'Sin mensajes todavía';

/**
 * ¿Esta tarjeta le escribe al GRUPO? La «MaKo en WhatsApp» (`avisar_al_equipo`), salvo la que va por email
 * (16/10/2026, «MaKo por email»): ésa le escribe al correo del equipo, no al grupo.
 */
export function vaAlGrupo(p: PasoGrafo | null | undefined): boolean {
  if (!esTarjetaMako(p)) return false;
  const params = (p?.accion as { params?: Record<string, unknown> } | null | undefined)?.params;
  return !esPorEmail(params);
}

/** ¿Hay algún paso que le escriba al grupo? Con uno, el grupo es un contacto más de «Probar». */
export const avisaAlGrupo = (pasos: readonly PasoGrafo[]): boolean => pasos.some(vaAlGrupo);

/**
 * ¿LA AUTOMATIZACIÓN SÓLO LE HABLA AL GRUPO? (17/10/2026, #852) Alguna tarjeta al grupo y ningún mensaje al lead: ni un
 * WhatsApp, un email o un DM, ni un AI Step (que contesta). Entonces «Probar en WhatsApp» es «Probar en el grupo».
 */
export const soloAlGrupo = (pasos: readonly PasoGrafo[]): boolean =>
  avisaAlGrupo(pasos) && !pasos.some((p) => esNodoMensaje(p) || esPasoIA(p));

/** El botón de «Probar» de una automatización que sólo le habla al grupo. */
export const PROBAR_EN_EL_GRUPO = 'Probar en el grupo';
/** El primer renglón del chat del grupo cuando la prueba SÍ le llega: lo que se ve abajo, llega. */
export const NOTA_DEL_GRUPO_DE_VERDAD = 'Prueba de verdad: esto le llega al grupo';
/** Lo que llega antes de los mensajes de la prueba: que nadie del equipo salga a buscar a un lead que no existe. */
export const ENCABEZADO_PRUEBA = (automatizacion: string, caso: string | null): string =>
  `🧪 Prueba de «${automatizacion.trim() || 'una automatización'}»${caso ? ` · ${caso}` : ''}. No es un lead real.`;

/** Lo que dijo el server del grupo de este negocio (`GET ?grupo=1`), o 'error' si no contestó. */
export type LecturaGrupo =
  | { hay: boolean; nombre: string | null; deCadaNegocio?: boolean }
  | 'error'
  | null;

/** El nombre del contacto: el REAL del grupo; si no se pudo leer, uno que no finge serlo. */
export function nombreDelGrupo(l: LecturaGrupo): string {
  if (l && l !== 'error') {
    if (l.deCadaNegocio) return NOMBRE_GRUPO_DE_CADA_NEGOCIO;
    if (l.nombre?.trim()) return l.nombre.trim();
  }
  return NOMBRE_GRUPO_SIN_LEER;
}

/** Una burbuja del grupo, sin id ni hora (los pone el panel). */
export type BurbujaGrupo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'audio'; audioId: number }
  | { tipo: 'media'; mediaId: number; caption: string };

/**
 * LO QUE LE LLEGA AL GRUPO de una tarjeta, como lo manda el motor (`armarAvisoDeTarjeta`, lib/mako-tarjeta.ts):
 * · CON `partes` (las de hoy): las partes TAL CUAL, en orden, cada texto con los datos de ejemplo;
 * · SIN `partes` (una de antes): UN texto envuelto («🟡 título», el mensaje, el lead, «— MaKo»).
 * `datos` resuelve los «{ }» con los de la prueba (`textoDeEjemplo`). Vacío = una tarjeta sin escribir.
 */
export function loQueLlegaAlGrupo(p: PasoGrafo, datos: (t: string) => string): BurbujaGrupo[] {
  const params = (p.accion as { params?: Record<string, unknown> } | null | undefined)?.params;
  const lista: ParteMensaje[] = partesDeMako(params);
  if (!lista.length) return [];
  if (esTarjetaTalCual(params)) {
    return lista.map((x): BurbujaGrupo => (x.tipo === 'audio'
      ? { tipo: 'audio', audioId: x.audio_id }
      : x.tipo === 'media'
        ? { tipo: 'media', mediaId: x.media_id, caption: datos(x.cuerpo ?? '') }
        : { tipo: 'texto', texto: datos(x.cuerpo) }));
  }
  const nombre = datos('{{nombre_completo}}');
  const titulo = datos(typeof params?.titulo === 'string' ? params.titulo : '') || `${nombre}: hay que verlo`;
  const aviso = armarAvisoDeTarjeta(params, {
    desdeUnFlujo: true, respuesta: '', lead: { id: 0, nombre, telefono: null }, linkLead: 'Link a su ficha',
    textos: { titulo, mensaje: datos(typeof params?.mensaje === 'string' ? params.mensaje : '') }, partes: null,
  });
  return [{ tipo: 'texto', texto: aviso.texto }];
}

/**
 * Las burbujas de la prueba como PARTES para mandarlas de verdad (texto con los datos de ejemplo ya puestos; el audio y
 * el archivo por su id, que el server vuelve a validar y baja). Una burbuja vacía no viaja.
 */
export function partesDeBurbujas(burbujas: readonly BurbujaGrupo[]): ParteMensaje[] {
  return burbujas.flatMap((b): ParteMensaje[] => {
    if (b.tipo === 'audio') return [{ tipo: 'audio', audio_id: b.audioId }];
    if (b.tipo === 'media') return [{ tipo: 'media', media_id: b.mediaId, ...(b.caption.trim() ? { cuerpo: b.caption } : {}) }];
    return b.texto.trim() ? [{ tipo: 'texto', cuerpo: b.texto }] : [];
  });
}
