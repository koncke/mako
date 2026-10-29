// =============================================================================
// planes-comparacion — la tabla «Compara los planes» de /planes (24/10/2026)
// =============================================================================
// Puro: lo usan app/planes/page.tsx y tests/planes-tres-bloques.test.ts.
//
// Los números NO se escriben a mano: salen de los topes que el código hace cumplir (lib/topes-plan.ts, `TOPES`), así la
// vitrina no puede prometer 3 automatizaciones si el producto frena en 2. Lo que es sólo de Pro sale de `TABS_SOLO_PRO` y
// de `FUNCIONES_SOLO_PRO`. El Acelerador trae MaKo Pro (docs/ofertas-mako.md §3): sus topes son los de Pro, y suma lo del programa.
//
// SIN LENGUAJE INTERNO (24/10/2026, noche, Martín: «las personas no saben que es "Ops Center" y muchas otras cosas»): cada
// fila dice lo que la persona CONSIGUE, nunca el nombre de una tab, y van por grupos, como el «Compare features» de Kajabi
// (kajabi.com/pricing, mirado el 24/10). La guarda está en tests/planes-tres-bloques.test.ts.
//
// Y PARA ALGUIEN QUE NO SABE (27/10/2026, Leila en la llamada con Martín, Fathom 876470842-16: «Una persona que no sabe no
// entiende…», sobre «Piloto automático: tu media buyer aplica los cambios solo, dentro de tus topes»): sin «media buyer», ni
// «embudo», ni «topes», ni «piloto automático». Y con TODO lo que trae MaKo (faltaban el scraper de WhatsApp, los videos, el
// dominio, cobrar y MaKo Partners). Cada fila corta: una línea en el teléfono.
// =============================================================================

import { TOPES, TABS_SOLO_PRO, type FuncionSoloPro, type Tope } from './topes-plan';

/** true = incluido, false = no incluido, texto = el tope. */
export type Celda = boolean | string;
export type FilaComparacion = { grupo: string; que: string; esencial: Celda; pro: Celda; acelerador: Celda };

const cantidad = (n: number | null, prefijo = ''): string => (n == null ? 'Sin tope' : `${prefijo}${n.toLocaleString('es-AR')}`);

/** Una fila de tope: Esencial es la capa `completo`; Pro y el Acelerador, `agencia`. */
const filaDeTope = (grupo: string, que: string, t: Tope, prefijo = ''): FilaComparacion => ({
  grupo,
  que,
  esencial: cantidad(TOPES.completo[t], prefijo),
  pro: cantidad(TOPES.agencia[t], prefijo),
  acelerador: cantidad(TOPES.agencia[t], prefijo),
});
const enTodos = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: true, pro: true, acelerador: true });
const soloPro = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: false, pro: true, acelerador: true });
const soloPrograma = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: false, pro: false, acelerador: true });

/** Las tabs que son sólo de Pro, con lo que consigue quien no conoce MaKo (nunca el nombre de la tab). */
export const NOMBRE_TAB_PRO: Readonly<Record<(typeof TABS_SOLO_PRO)[number], string>> = {
  'closing-analyst': 'Qué mejorar en cada llamada de venta, con IA',
  // 29/10/2026 (el Cerebro, con el inventario del taller): el editor tipo Canva existe y su chat edita el diseño, pero generar
  // imágenes con IA NO (lib/image-editor/chat/catalogo.ts, `NO_SE_PUEDE_CHAT_IMAGEN`; Image Generator es «pronto»).
  'image-editor': 'Diseñar tus imágenes sin salir de MaKo',
  'video-editor': 'Editar tus videos sin salir de MaKo',
};

/**
 * Las tabs de Pro que TODAVÍA no se abrieron: no se venden (28/10/2026, lo que Martín le prometió a Teo). Hoy ninguna: AI Avatar
 * (la única que estuvo acá) se abrió el 29/10/2026 a los TRES planes y ya no es de Pro (su fila es `NOMBRE_AI_AVATAR`).
 */
export const TABS_TODAVIA_CERRADAS: readonly (typeof TABS_SOLO_PRO)[number][] = [];

/** La fila de AI Avatar en la tabla: está en los tres planes (ya no es una tab de Pro). */
export const NOMBRE_AI_AVATAR = 'Videos con una persona hecha con IA que habla por ti';

/** Lo demás que es sólo de Pro (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`), dicho igual. */

export const NOMBRE_FUNCION_PRO: Readonly<Record<FuncionSoloPro, string>> = {
  'scraper-whatsapp': 'Sumar a tu lista los contactos de tus grupos de WhatsApp',
};

export const GRUPOS_COMPARACION = [
  'Tu asistente', 'Conseguir clientes', 'Vender y cobrar', 'Atender', 'Anuncios y contenido', 'Equipo', 'Recomendar MaKo', 'Acompañamiento',
] as const;

export function filasDeComparacion(): FilaComparacion[] {
  const [asistente, conseguir, vender, atender, anuncios, equipo, recomendar, acompanamiento] = GRUPOS_COMPARACION;
  return [
    enTodos(asistente, 'MaKo, un asistente con IA que conoce tu negocio'),
    filaDeTope(conseguir, 'Páginas web para vender, publicadas', 'web.landings_publicadas'),
    filaDeTope(conseguir, 'Dominios propios para tus páginas (tunegocio.com)', 'web.dominios'),
    soloPro(conseguir, NOMBRE_FUNCION_PRO['scraper-whatsapp']),
    filaDeTope(vender, 'Contactos guardados (interesados y clientes)', 'crm.leads', 'Hasta '),
    filaDeTope(vender, 'Tableros de ventas, para ver en qué paso está cada cliente', 'crm.funnels'),
    filaDeTope(vender, 'Seguimientos automáticos activos a la vez', 'automations.activas'),
    filaDeTope(vender, 'Cuentas para cobrar con Mercado Pago o Stripe', 'cobros.cuentas'),
    soloPro(vender, NOMBRE_TAB_PRO['closing-analyst']),
    filaDeTope(atender, 'Números de WhatsApp conectados, más tu Instagram', 'chats.lineas_whatsapp'),
    // 29/10/2026: «Videos para tus anuncios, armados con IA» (el Video Generator) salió de la tabla: está a medias (depende de
    // la extensión y de los créditos de Flow del cliente, y al motor nunca se lo midió en vivo). Vuelve cuando un cliente lo use.
    // Lo que en Esencial propone y no aplica solo (25/10/2026); cuántas ideas, del tope del plan.
    filaDeTope(anuncios, 'Ideas por día para mejorar tus anuncios', 'ads.recomendaciones_dia'),
    // AI Avatar, en los tres planes desde el 29/10/2026 (Martín: «haz que AI-Avatar esté disponible para todos»). Genera con la
    // cuenta de Google Flow de la persona: la pantalla lo dice paso a paso antes de «Generar» (lib/ai-avatar/requisitos.ts).
    enTodos(anuncios, NOMBRE_AI_AVATAR),
    soloPro(anuncios, 'MaKo aplica las mejoras solo, sin pasarse de tu presupuesto'),
    soloPro(anuncios, NOMBRE_TAB_PRO['image-editor']),
    soloPro(anuncios, NOMBRE_TAB_PRO['video-editor']),
    filaDeTope(equipo, 'Personas de tu equipo, cada una con su acceso', 'equipo.usuarios'),
    soloPro(equipo, 'Si eres agencia: los negocios de tus clientes'),
    // MaKo Partners, en todos los planes desde el 29/10/2026 (como lo dicen las landings).
    enTodos(recomendar, 'Ganar el primer mes de cada negocio que traes a MaKo'),
    soloPrograma(acompanamiento, 'Tus páginas, mensajes y anuncios armados en la primera semana'),
    soloPrograma(acompanamiento, 'La asesoría grupal en vivo con Martín, cada semana'),
    soloPrograma(acompanamiento, 'Plantillas probadas de páginas, mensajes y guiones'),
    soloPrograma(acompanamiento, 'Un grupo de WhatsApp con respuestas de Martín'),
  ];
}

/**
 * La celda de un plan por su CAPA y no por su id: los números salen de los topes de la capa, así que un plan del setting
 * `planes.mako` con otro id dice lo que su capa le da. Una capa sin columna (pm), null: no se inventa.
 */
export function celdaDeCapa(f: FilaComparacion, capa: string): Celda | null {
  return capa === 'completo' ? f.esencial : capa === 'agencia' ? f.pro : null;
}

/**
 * Lo que un plan NO trae, de la misma tabla (29/10/2026, Martín: el pricing «no aclara todo lo que incluye o lo que no»):
 * cada tarjeta lo dice con ✗, y no puede contradecir a la comparación porque sale de ella.
 */
export function noIncluyeDe(capa: string): string[] {
  return filasDeComparacion().filter((f) => celdaDeCapa(f, capa) === false).map((f) => f.que);
}
