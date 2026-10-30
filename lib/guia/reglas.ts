// =============================================================================
// La guía de cada pestaña: lo que decide, sin IA (PURO; 29/10/2026)
// =============================================================================
// docs/mako-iniciativa/guia.md §2.5 y §3. Todo lo que dice la guía en el chat es una APERTURA (lib/aperturas/reglas.ts), con
// la pieza de siempre (app/_chat/AperturaMako.tsx): botones armados por el código con el catálogo de la tab. Lo «personalizado»
// sin IA sale de los HECHOS de la tab (sin la app → «Conectar tu IA» va primero), de lo que está en pantalla (un objetivo cuya
// primera ancla no está, y no tiene `antes`, no se ofrece) y del rol.
//   ① la primera vez: «¿Quieres que te ayude a aprender a usar esta pestaña?» [Sí, enséñame ★] [<otro objetivo>] [Ya sé usarla]
//      (la frase literal de Martín: lib/aperturas/reglas.ts → EXCEPCIONES_PREGUNTA_DE_ACCION dice por qué);
//   ② el «?» de la tab: «¿Qué quieres hacer?» [objetivo] [objetivo] [Dónde está…];
//   ③ señalando: la frase va al lado del ancla, y en el chat sólo «Salir»;
//   ④ al terminar: «Listo. ¿Algo más?» [objetivo] [No, gracias].
// «Recomendado» NO es una recomendación (lib/recomendaciones*.ts): ordena qué enseñar primero con hechos de la pantalla.
// =============================================================================

import type { Apertura, Boton } from '@/lib/aperturas/reglas';
import type { Ancla, GuiaDeTab, HechosGuia, ObjetivoGuia, PasoGuia, RolGuia } from './tipos';

export const TOPE_NOMBRE = 24;
export const TOPE_TITULO = 24;
export const TOPE_FRASE = 60;
export const MAX_PASOS = 3;
export const MIN_OBJETIVOS = 2;
export const MAX_OBJETIVOS = 4;
/** Cuánto mira la persona la pantalla antes de que MaKo pregunte (desde que la tab dice «lista»). */
export const ESPERA_PREGUNTA_MS = 1_200;
/** Cuánto se espera a que aparezca lo que se señala: si no, «No lo veo en esta pantalla» (nunca un velo sobre la nada). */
export const ESPERA_ANCLA_MS = 1_500;
/** Después de tocar el `antes` (abrir un menú), cuánto se espera a que aparezca el destino. */
export const ESPERA_TRAS_ANTES_MS = 2_000;
/** Hasta este ancho de ventana, el chat y la tab no conviven: al señalar, el chat se aparta. */
export const ANCHO_ANGOSTO = 760;

/** La pregunta de la primera vez: la frase de Martín, textual (29/10/2026). */
export const PREGUNTA_PRIMERA_VEZ = '¿Quieres que te ayude a aprender a usar esta pestaña?';
export const SI_ENSENAME = 'Sí, enséñame';
export const DONDE_ESTA = 'Dónde está…';
export const OTRAS = 'Otras';

/** Los valores de los botones de la guía (`respuesta`): qué hacer con el toque. */
export const valorObjetivo = (id: string): string => `obj:${id}`;
export const valorAncla = (id: string): string => `ancla:${id}`;
export const VALOR_SI = 'si';
export const VALOR_DONDE = 'donde';
export const VALOR_OTRAS = 'otras';
export const VALOR_SEGUIR = 'seguir';

export type LeerValor = { tipo: 'si' } | { tipo: 'objetivo'; id: string } | { tipo: 'ancla'; id: string } | { tipo: 'donde' } | { tipo: 'otras' } | { tipo: 'seguir' };
export function leerValor(v: string): LeerValor | null {
  if (v === VALOR_SI) return { tipo: 'si' };
  if (v === VALOR_DONDE) return { tipo: 'donde' };
  if (v === VALOR_OTRAS) return { tipo: 'otras' };
  if (v === VALOR_SEGUIR) return { tipo: 'seguir' };
  if (v.startsWith('obj:')) return { tipo: 'objetivo', id: v.slice(4) };
  if (v.startsWith('ancla:')) return { tipo: 'ancla', id: v.slice(6) };
  return null;
}

const anclaDe = (g: GuiaDeTab, id: string): Ancla | undefined => g.anclas.find((a) => a.id === id);

/**
 * Los objetivos que se ofrecen, en orden (el primero es el recomendado): los que piden estos hechos (`si`), los del rol, y sólo
 * los que se pueden empezar (su primera ancla está en pantalla, o está su `antes`). Con un `si` que da true primero: un hecho de
 * la pantalla («sin la app») sube el objetivo que lo resuelve.
 */
export function objetivosOfrecidos(g: GuiaDeTab, h: HechosGuia, presente: (ancla: string) => boolean, rol?: RolGuia): ObjetivoGuia[] {
  const sirve = g.objetivos.filter((o) => {
    if (o.si && !o.si(h)) return false;
    if (o.roles && rol && !o.roles.includes(rol)) return false;
    const primera = o.pasos[0]?.ancla;
    if (!primera) return false;
    if (presente(primera)) return true;
    const antes = anclaDe(g, primera)?.antes;
    return !!antes && presente(antes);
  });
  // Los que dependen de un hecho que se cumplió van primero (estable: el orden del catálogo, si no).
  return sirve.map((o, i) => ({ o, i })).sort((a, b) => Number(!!b.o.si) - Number(!!a.o.si) || a.i - b.i).map((x) => x.o);
}

const callar = (rotulo: 'Ya sé usarla' | 'No, gracias' | 'Salir' | 'Ahora no'): Boton => ({ tipo: 'callar', rotulo });

/** ① La primera vez. [Sí, enséñame ★] empieza el recomendado; los otros (hasta dos) empiezan el suyo. */
export function preguntaDeLaGuia(g: GuiaDeTab, ofrecidos: readonly ObjetivoGuia[]): Apertura {
  return {
    id: `guia:${g.key}`, alcance: 'negocio', texto: PREGUNTA_PRIMERA_VEZ,
    botones: [
      { tipo: 'respuesta', rotulo: SI_ENSENAME, valor: VALOR_SI },
      ...ofrecidos.slice(1, 3).map((o) => ({ tipo: 'respuesta' as const, rotulo: o.titulo, valor: valorObjetivo(o.id) })),
      callar('Ya sé usarla'),
    ],
  };
}

/** ② El «?»: los objetivos (hasta dos) y «Dónde está…» si hay anclas con pregunta. */
export function preguntaQueHacer(g: GuiaDeTab, ofrecidos: readonly ObjetivoGuia[], conDonde: boolean): Apertura {
  const objetivos = ofrecidos.slice(0, conDonde ? 2 : 3).map((o) => ({ tipo: 'respuesta' as const, rotulo: o.titulo, valor: valorObjetivo(o.id) }));
  return {
    id: `guia:${g.key}-que`, alcance: 'negocio', texto: '¿Qué quieres hacer?',
    botones: [...objetivos, ...(conDonde ? [{ tipo: 'respuesta' as const, rotulo: DONDE_ESTA, valor: VALOR_DONDE }] : []), callar('Ahora no')],
  };
}

/** «Dónde está…»: las preguntas de las anclas en pantalla, de a 3 (con «Otras» si hay más). */
export function preguntaDonde(g: GuiaDeTab, presente: (ancla: string) => boolean, desde = 0): Apertura {
  const conPregunta = g.anclas.filter((a) => a.pregunta && presente(a.id));
  const tanda = conPregunta.slice(desde, desde + 3);
  const hayMas = conPregunta.length > desde + 3;
  const botones: Boton[] = (hayMas ? tanda.slice(0, 2) : tanda).map((a) => ({ tipo: 'respuesta', rotulo: a.pregunta!, valor: valorAncla(a.id) }));
  if (hayMas) botones.push({ tipo: 'respuesta', rotulo: OTRAS, valor: VALOR_OTRAS });
  botones.push(callar('Ahora no'));
  return { id: `guia:${g.key}-donde`, alcance: 'negocio', texto: '¿Qué estás buscando?', botones };
}

/** ③ Mientras señala: en el chat, la frase del paso (la misma que al lado del ancla, para el lector de pantalla) y «Salir». */
export function mientrasSenala(g: GuiaDeTab, frase: string): Apertura {
  return { id: `guia:${g.key}-paso`, alcance: 'negocio', texto: frase, botones: [callar('Salir')] };
}

/** La pausa (tocó otra parte de la tab, o Escape): «Seguir» por esta visita, sin insistir. */
export function enPausa(g: GuiaDeTab, objetivo: ObjetivoGuia): Apertura {
  return { id: `guia:${g.key}-pausa`, alcance: 'negocio', texto: `Paré de señalar: ${objetivo.titulo.toLowerCase()}.`, botones: [{ tipo: 'respuesta', rotulo: 'Seguir', valor: VALOR_SEGUIR }, callar('Salir')] };
}

/** ④ Al terminar un objetivo: los otros, y «No, gracias». */
export function listoAlgoMas(g: GuiaDeTab, ofrecidos: readonly ObjetivoGuia[], hecho: string): Apertura {
  return {
    id: `guia:${g.key}-listo`, alcance: 'negocio', texto: 'Listo. ¿Algo más?',
    botones: [...ofrecidos.filter((o) => o.id !== hecho).slice(0, 2).map((o) => ({ tipo: 'respuesta' as const, rotulo: o.titulo, valor: valorObjetivo(o.id) })), callar('No, gracias')],
  };
}

/** Lo que no se pudo señalar, en una línea (sin velo: nunca se oscurece para señalar la nada). */
export function noLoVeo(g: GuiaDeTab, porque: 'no-esta' | 'modal'): Apertura {
  return {
    id: `guia:${g.key}-no-esta`, alcance: 'negocio',
    texto: porque === 'modal' ? 'Cierra esta ventana primero y te lo señalo.' : 'No lo veo en esta pantalla.',
    botones: [callar('Salir')],
  };
}

/** La frase de un paso: la que escribió quien lo pidió, o el `para` del ancla. Con su `antes` primero: «Primero toca X». */
export const fraseDe = (g: GuiaDeTab, p: PasoGuia): string => p.frase ?? anclaDe(g, p.ancla)?.para ?? '';
export const fraseAntes = (g: GuiaDeTab, antes: string): string => anclaDe(g, antes)?.para ?? `Primero toca ${anclaDe(g, antes)?.nombre ?? 'aquí'}.`;

/**
 * Qué paso se señala de verdad: el pedido, o su `antes` si el pedido no está en pantalla y su `antes` sí («Primero abre este
 * menú»). `null` = ninguno de los dos está (quien llama espera `ESPERA_ANCLA_MS` y dice «No lo veo»).
 */
export function anclaASenalar(g: GuiaDeTab, p: PasoGuia, presente: (ancla: string) => boolean): { ancla: string; antes: boolean } | null {
  if (presente(p.ancla)) return { ancla: p.ancla, antes: false };
  const antes = anclaDe(g, p.ancla)?.antes;
  return antes && presente(antes) ? { ancla: antes, antes: true } : null;
}

/**
 * Qué hace un toque mientras se señala (guia.md §2.8): en el ancla, el paso se hizo (el toque llega igual a la tab); adentro del
 * chat o del globo, nada (se puede escribirle a MaKo con la guía puesta); en otra parte de la tab, PAUSA (el toque llega igual:
 * «si ya lo quiere usar, que lo use»).
 */
export function queHacerConElToque(t: { enAncla: boolean; enChat: boolean; enGlobo: boolean }): 'avanza' | 'nada' | 'pausa' {
  if (t.enAncla) return 'avanza';
  if (t.enChat || t.enGlobo) return 'nada';
  return 'pausa';
}

/**
 * ¿Pregunta ahora, la primera vez? (guia.md §3.2) Todas a la vez: ya se sabe que no la vio (con null NO: aparecería un instante
 * a quien ya contestó), la tab está lista hace 1,2 s, no hay un modal ni otra apertura hablando, no está en su onboarding sin
 * terminar, y no es una tab de computadora en una ventana angosta.
 */
export function debePreguntar(e: {
  yaLaVio: boolean | null;
  listoHaceMs: number | null;
  modalAbierto: boolean;
  otraHablando: boolean;
  onboardingPendiente?: boolean;
  soloComputadora?: boolean;
  angosta?: boolean;
}): boolean {
  if (e.yaLaVio !== false) return false;
  if (e.listoHaceMs == null || e.listoHaceMs < ESPERA_PREGUNTA_MS) return false;
  if (e.modalAbierto || e.otraHablando || e.onboardingPendiente) return false;
  if (e.soloComputadora && e.angosta) return false;
  return true;
}

/** Lo que un catálogo tiene mal (vacío = bien). Lo corre tests/guia-catalogo.test.ts sobre todos. */
export function problemasDeGuia(g: GuiaDeTab, prefijos: readonly string[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const a of g.anclas) {
    if (ids.has(a.id)) out.push(`${a.id}: repetida`);
    ids.add(a.id);
    if (!prefijos.some((p) => a.id.startsWith(p))) out.push(`${a.id}: sin el prefijo de su tab (${prefijos.join(', ')})`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) out.push(`${a.id}: el id es una clave (minúsculas y guiones)`);
    if (a.nombre.length > TOPE_NOMBRE) out.push(`${a.id}: el nombre pasa de ${TOPE_NOMBRE}`);
    if (a.para.length > TOPE_FRASE) out.push(`${a.id}: «para» pasa de ${TOPE_FRASE}`);
    if (a.pregunta && a.pregunta.length > 28) out.push(`${a.id}: la pregunta pasa de 28 (es un botón)`);
    if (a.antes && !g.anclas.some((x) => x.id === a.antes)) out.push(`${a.id}: su «antes» (${a.antes}) no está en el catálogo`);
  }
  if (g.objetivos.length < MIN_OBJETIVOS || g.objetivos.length > MAX_OBJETIVOS) out.push(`tiene ${g.objetivos.length} objetivos (de ${MIN_OBJETIVOS} a ${MAX_OBJETIVOS})`);
  const objs = new Set<string>();
  for (const o of g.objetivos) {
    if (objs.has(o.id)) out.push(`objetivo ${o.id}: repetido`);
    objs.add(o.id);
    if (o.titulo.length > TOPE_TITULO) out.push(`objetivo ${o.id}: el título pasa de ${TOPE_TITULO}`);
    if (o.pasos.length < 1 || o.pasos.length > MAX_PASOS) out.push(`objetivo ${o.id}: ${o.pasos.length} pasos (de 1 a ${MAX_PASOS})`);
    for (const p of o.pasos) {
      if (!ids.has(p.ancla)) out.push(`objetivo ${o.id}: el ancla ${p.ancla} no está en el catálogo`);
      if (p.frase && p.frase.length > TOPE_FRASE) out.push(`objetivo ${o.id}: la frase de ${p.ancla} pasa de ${TOPE_FRASE}`);
      if (p.hecho && typeof p.hecho === 'object' && !ids.has(p.hecho.aparece)) out.push(`objetivo ${o.id}: «aparece» ${p.hecho.aparece} no está en el catálogo`);
    }
  }
  return out;
}

/** Todos los textos que la persona lee de un catálogo (para el voseo y «Toca», no «Haz clic»). */
export function textosDeGuia(g: GuiaDeTab): string[] {
  return [g.nombre, ...g.anclas.flatMap((a) => [a.nombre, a.para, a.pregunta ?? '']), ...g.objetivos.flatMap((o) => [o.titulo, ...o.pasos.map((p) => p.frase ?? '')])].filter(Boolean);
}
