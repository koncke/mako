// =============================================================================
// La comparación con la competencia, app por app (14/11/2026)
// =============================================================================
// Martín (14/11/2026), sobre /vsl/comparaciones: «no es como la referencia: que sea scrolleable, una tabla de lo que la competencia
// tiene o no tiene, con comentarios, y las tarjetas de MaKo vs tal cosa abajo». El molde es beehiiv.com/comparisons (relevado en
// la carpeta de notas, referencias-comparar/beehiiv-comparisons.md): MaKo fijo y los competidores en columnas que se deslizan; ✓ en
// su círculo si la app lo tiene, la celda VACÍA si no, un valor corto si hay un matiz; sin notas dentro de la tabla (el porqué va
// en las tarjetas y en la página de cada uno).
//
// LO QUE SE DICE DE OTRA APP ES PÚBLICO: cada celda de los competidores sale de una investigación con su fuente (la web oficial de
// la app: precios, funciones, ayuda), en ./competencia-datos.ts. Lo que no se pudo confirmar queda «sin dato», nunca como un «no».
// Las de MaKo salen del código: lo que es sólo de Pro (lib/topes-plan.ts) dice «En Pro», y el precio es el de Esencial.
// ⚠️ ESO VALE PARA LA COLUMNA DE LA TABLA, NO PARA TODO LO QUE DICE LA PÁGINA: `ELIGE_MAKO_SI`, más abajo, es copy a mano y
// lleva el MISMO tilde que una celda «si». Lo que lo vigila está en su comentario.
// =============================================================================

import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';
import { FUNCIONES_SOLO_PRO, TABS_SOLO_PRO, TOPES, type FuncionSoloPro, type Tope } from '@/lib/topes-plan';
import { COMPETIDORES_RELEVADOS, RELEVADO_EL } from './competencia-datos';

export type ClaveFila =
  | 'precio' | 'landings' | 'landings_ia' | 'copiar_landing' | 'spy' | 'dominio'
  | 'crm' | 'tracking' | 'agenda' | 'cuotas' | 'llamadas_ia'
  | 'whatsapp' | 'instagram_dm' | 'setter_ia' | 'automatizaciones' | 'email'
  | 'copy_ia' | 'editor_imagen' | 'editor_video' | 'video_ia' | 'ads_ia' | 'calendario'
  | 'cursos' | 'comunidad' | 'asistente_ia' | 'espanol';

/** Una celda: 'si' (✓), 'no' (vacía), '?' (sin dato: no se pudo confirmar) o un valor corto. */
export type Celda = { v: string; fuente?: string };

export type Competidor = {
  nombre: string;
  slug: string;
  web: string;
  /** El logo original (public/vsl-assets/logos/apps). */
  logo: string;
  celdas: Partial<Record<ClaveFila, Celda>>;
  /** «Elige {X} si»: su mejor caso, reconocido con honestidad. */
  eligeSi: readonly string[];
  /**
   * Una frase: la limitación concreta y lo que le cuesta a quien vende High Ticket.
   * ⚠️ LE PEGA AL COMPETIDOR POR UNA FILA DE ESTA MISMA TABLA, y la columna de MaKo se DERIVA: el día que esa fila se cierre
   * en Esencial, la página le pega al otro por algo que la tabla dice «En Pro» un bloque más abajo, en la misma página. Pasó
   * el 15/11 con GoHighLevel y el setter con IA. Cada comentario declara en qué fila se apoya
   * (`COMENTARIO_SE_APOYA_EN`, tests/vsl-comparaciones-competencia.test.ts) y la prueba se pone roja si esa fila deja de ser
   * de Esencial. Arreglar la contradicción es decidir cómo se vende: la decide Martín.
   */
  comentario: string;
};

/** Los grupos y sus filas, de lo que más se compara (el precio) a lo que menos, con nombres de marketing de 1 a 4 palabras. */
export const GRUPOS_MATRIZ: ReadonlyArray<{ titulo: string; filas: ReadonlyArray<{ clave: ClaveFila; nombre: string }> }> = [
  { titulo: 'Precio', filas: [{ clave: 'precio', nombre: 'Precio para empezar' }] },
  { titulo: 'Captación de leads', filas: [
    { clave: 'landings', nombre: 'Landings' },
    { clave: 'landings_ia', nombre: 'Landings con IA' },
    { clave: 'copiar_landing', nombre: 'Copiar landings de otros' },
    { clave: 'spy', nombre: 'Espiar a la competencia' },
    { clave: 'dominio', nombre: 'Dominio propio' },
  ] },
  { titulo: 'CRM y ventas', filas: [
    { clave: 'crm', nombre: 'CRM con pipelines' },
    { clave: 'tracking', nombre: 'Tracking de cada lead' },
    { clave: 'agenda', nombre: 'Agenda de llamadas' },
    { clave: 'cuotas', nombre: 'Cobros en cuotas' },
    { clave: 'llamadas_ia', nombre: 'Análisis de llamadas con IA' },
  ] },
  { titulo: 'Chats y automatizaciones', filas: [
    { clave: 'whatsapp', nombre: 'Bandeja de WhatsApp' },
    { clave: 'instagram_dm', nombre: 'DMs de Instagram' },
    { clave: 'setter_ia', nombre: 'Setter con IA' },
    { clave: 'automatizaciones', nombre: 'Automatizaciones' },
    { clave: 'email', nombre: 'Email marketing' },
  ] },
  { titulo: 'Contenido y anuncios', filas: [
    { clave: 'copy_ia', nombre: 'Copywriting con IA' },
    { clave: 'editor_imagen', nombre: 'Editor de imágenes' },
    { clave: 'editor_video', nombre: 'Editor de video' },
    { clave: 'video_ia', nombre: 'Edición de video con IA' },
    { clave: 'ads_ia', nombre: 'Anuncios de Meta con IA' },
    { clave: 'calendario', nombre: 'Calendario de contenido' },
  ] },
  { titulo: 'Entrega', filas: [
    { clave: 'cursos', nombre: 'Cursos' },
    { clave: 'comunidad', nombre: 'Comunidad' },
  ] },
  { titulo: 'IA e idioma', filas: [
    { clave: 'asistente_ia', nombre: 'Asistente con IA de tu negocio' },
    { clave: 'espanol', nombre: 'En español' },
  ] },
];

// ── LA COLUMNA DE MaKo SE DERIVA DEL CÓDIGO, NO SE TIPEA (15/11/2026) ─────────────────────────────────────────────────
// Hasta hoy acá había una lista ESCRITA A MANO (`SOLO_PRO`) de cuatro filas y `celdaDeMaKo` devolvía «si» para TODO lo demás.
// El 14/11 se cerraron en Esencial el setter con IA (`FUNCIONES_SOLO_PRO`, 'setter-ia') y el dominio propio
// (`TOPES.completo['web.dominios']` = 0, lib/editor-landing/tope-landings.ts lo hace cumplir), nadie volvió a esta lista, y
// esta tabla siguió poniéndoles ✓ al lado del precio de Esencial: alguien elegía su plan leyendo una promesa que el producto no
// le iba a cumplir, y /planes decía lo contrario en la misma web. La lista a mano fallaba hacia el «sí», el lado que miente
// a favor.
// La regla es la que /planes ya aplica (lib/planes-comparacion.ts, `soloPro` y `filaDeTope`): cada fila DECLARA cuál es el
// candado o el tope que la gobierna y la celda se LEE de ahí, así el día que se cierre la función siguiente esta columna se
// entera sola. Y lo que no declara nada cae en «En Pro», nunca en «si».
// Martín, 14/11/2026: «el de 47 debería estar bien limitado y restrictivo… la idea es que compren el de 97, no el de 47».

type TabSoloPro = (typeof TABS_SOLO_PRO)[number];

/** Qué decide, EN EL CÓDIGO, si Esencial (la capa `completo`) tiene esa fila. */
type Candado =
  /** La cierra una función de Pro (`FUNCIONES_SOLO_PRO`). */
  | { funcion: FuncionSoloPro }
  /** La cierra una tab de Pro (`TABS_SOLO_PRO`). */
  | { tab: TabSoloPro }
  /** La gobierna un tope (`TOPES`): en 0 es «no lo trae»; mayor que 0 es «lo trae» (con su tope). */
  | { tope: Tope }
  /** Sin candado ni tope: está en los dos planes. */
  | { enLosDos: true };

/**
 * DE DÓNDE SALE CADA FILA. Exhaustivo a propósito (`Record`, no `Partial`): una fila nueva en `ClaveFila` no compila hasta
 * decir qué la gobierna, que es justo el paso que se saltó el 14/11.
 */
export const CANDADO_DE_LA_FILA: Readonly<Record<Exclude<ClaveFila, 'precio'>, Candado>> = {
  landings: { tope: 'web.landings_publicadas' },
  // Armarlas con IA no es una función aparte: el Web Generator es uno y lo que se cuenta son las publicadas.
  landings_ia: { tope: 'web.landings_publicadas' },
  copiar_landing: { funcion: 'replicar-landing' },
  spy: { tope: 'spy.competidores' },
  // 14/11/2026, noche (Martín, mirando /planes): Esencial SIN dominio propio (el tope pasó de 1 a 0).
  dominio: { tope: 'web.dominios' },
  crm: { tope: 'crm.funnels' },
  tracking: { enLosDos: true },
  agenda: { enLosDos: true },
  // «Cobros en cuotas» y «Bandeja de WhatsApp» no tienen candado propio: lo que las habilita es poder conectar la cuenta de
  // cobro y el número de WhatsApp. Un tope en 0 ahí vacía la promesa de la fila, así que es ÉSE el que manda.
  cuotas: { tope: 'cobros.cuentas' },
  llamadas_ia: { tab: 'closing-analyst' },
  whatsapp: { tope: 'chats.lineas_whatsapp' },
  instagram_dm: { enLosDos: true },
  // 14/11/2026, noche (Martín): el setter con IA es de Pro. Esta fila decía «si» hasta el 15/11.
  setter_ia: { funcion: 'setter-ia' },
  automatizaciones: { tope: 'automations.activas' },
  email: { enLosDos: true },
  copy_ia: { enLosDos: true },
  // Los editores son de los dos planes; lo de Pro es su IA (lib/topes-plan.ts, 'ia-editores', 14/11/2026).
  editor_imagen: { enLosDos: true },
  editor_video: { enLosDos: true },
  video_ia: { funcion: 'ia-editores' },
  // ⚠️ NO es una fila de Pro: Esencial trae el media buyer en modo «propone», con `ads.recomendaciones_dia` = 2
  // (25/10/2026). De Pro es el PILOTO automático, que no tiene fila en esta tabla.
  ads_ia: { tope: 'ads.recomendaciones_dia' },
  calendario: { enLosDos: true },
  cursos: { tope: 'classroom.cursos' },
  comunidad: { funcion: 'comunidad' },
  // El asistente de MaKo es de los dos planes; hablar con los REFERENTES es de Pro ('chat-referentes') y no tiene fila acá.
  asistente_ia: { enLosDos: true },
  espanol: { enLosDos: true },
};

/** Lo que dice la celda cuando eso es sólo de MaKo Pro (lo dibuja `ValorCelda` como un valor corto). */
export const EN_PRO = 'En Pro';

/** La columna de MaKo: el precio de Esencial y, fila por fila, lo que el código le da hoy a la capa `completo`. */
export function celdaDeMaKo(clave: ClaveFila): Celda {
  if (clave === 'precio') return { v: `US$ ${PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')?.precioUsd ?? 47}` };
  const c: Candado | undefined = (CANDADO_DE_LA_FILA as Partial<Record<ClaveFila, Candado>>)[clave];
  // Una fila que no declara de dónde sale: «En Pro». El tipo de arriba ya no deja agregarla sin decirlo, y si igual llega
  // (un `as`, un dato de afuera), la tabla se queda del lado que NO promete lo que no hay.
  if (!c) return { v: EN_PRO };
  if ('funcion' in c) return { v: (FUNCIONES_SOLO_PRO as readonly string[]).includes(c.funcion) ? EN_PRO : 'si' };
  if ('tab' in c) return { v: (TABS_SOLO_PRO as readonly string[]).includes(c.tab) ? EN_PRO : 'si' };
  if ('tope' in c) {
    if (TOPES.completo[c.tope] !== 0) return { v: 'si' };
    // 0 en Esencial: lo trae Pro. Salvo que ahí también sea 0, y entonces no es de nadie: la celda va vacía, no «En Pro».
    return { v: TOPES.agencia[c.tope] === 0 ? 'no' : EN_PRO };
  }
  return { v: 'si' };
}

export const COMPETIDORES: readonly Competidor[] = COMPETIDORES_RELEVADOS;
export { RELEVADO_EL };

export const competidorDeSlug = (slug: string): Competidor | undefined => COMPETIDORES.find((c) => c.slug === slug);

export const rutaVs = (c: Pick<Competidor, 'slug'>): string => `/vsl/comparaciones/${c.slug}`;

/**
 * «Elige MaKo si»: las mismas cinco en todas las páginas (como beehiiv).
 *
 * ⚠️ ESTO ES COPY A MANO, AL LADO DE UNA COLUMNA QUE SÍ SE DERIVA (15/11/2026). No es una lista de plan: es el
 * POSICIONAMIENTO de MaKo contra el competidor. Pero se dibuja con el MISMO tilde que una celda «si» (`s-mx-si`,
 * Comparaciones.tsx:156 y :250), dentro del panel donde la fila de precio dice el de Esencial, y DOS de los cinco nombran
 * cosas que Esencial no tiene: el tercero es el setter con IA ('setter-ia') y el cuarto es replicar ('replicar-landing' y
 * 'replicar-guion'), las tres en `FUNCIONES_SOLO_PRO`.
 * ⛔ No se toca por iniciativa de un agente: cambiar el copy o escribirle «(en Pro)» cambia cómo se vende MaKo, y eso lo
 *    decide Martín. Lo que sí está cerrado es que no se desincronice en silencio: cada ítem declara qué nombra de Pro Y qué
 *    filas de la tabla promete con el tilde pelado, en tests/vsl-comparaciones-competencia.test.ts (`ELIGE_NOMBRA`). Editar
 *    el copy, abrir una de esas funciones en Esencial o CERRAR una de esas filas (un tope en 0) pone esa prueba roja.
 */
export const ELIGE_MAKO_SI: readonly string[] = [
  'Vendes servicios, mentorías o programas de ticket alto.',
  'Quieres tu CRM, tu WhatsApp y tus landings en una sola app.',
  'Quieres que la IA conteste, haga el seguimiento y agende por ti.',
  'Quieres ver lo que le funciona a tu competencia y replicarlo.',
  'Trabajas en español, con personas reales del otro lado.',
];
