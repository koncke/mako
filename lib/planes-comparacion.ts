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
//
// EL RELEVAMIENTO DEL 12/11/2026 (Martín: «hagas nuevamente la parte de compara los planes… relevamiento de qué se incluye en
// cada cosa»). La tabla dice TODO lo que trae MaKo, función por función, de lib/funciones-mako.ts (sólo lo que anda) y de quién
// ve cada pantalla: las capas `completo` (Esencial) y `agencia` (Pro) ven todas las pantallas (lib/capas.ts, `navKeys: null`)
// menos las de `TABS_SOLO_PRO`, que en Esencial van con candado. Así que casi todo está en los tres planes, y lo que cambia son
// los topes y lo de Pro. Los grupos se abren y se cierran, como el «Compare features» de beehiiv (beehiiv.com/pricing): el
// primero, lo que entra en cada plan, abierto.
// =============================================================================

import { TOPES, TABS_SOLO_PRO, type FuncionSoloPro, type Tope } from './topes-plan';
import { ASESORES } from './asesores/catalogo';
import { planConPrueba, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA } from './planes-mako';

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
 * (la única que estuvo acá) se abrió el 29/10/2026 a los TRES planes y ya no es de Pro; su fila espera `AI_AVATAR_SE_VENDE`.
 */
export const TABS_TODAVIA_CERRADAS: readonly (typeof TABS_SOLO_PRO)[number][] = [];

/**
 * ¿La tabla VENDE AI Avatar? NO, aunque la tab esté abierta en los tres planes (29/10/2026, el Cerebro: «no se vende lo que no
 * anduvo de punta a punta», el mismo criterio que sacó los videos del Video Generator). Vuelve a `true` cuando Martín genere un
 * look real en el ws3 Y la tienda de Chrome publique la extensión 0.69 o más (`lib/extension-tienda.ts`). Ese día la fila dice
 * que se paga con los créditos de Google Flow de la persona (lo pide el test).
 */
export const AI_AVATAR_SE_VENDE = false;

/** La fila de AI Avatar en la tabla, para cuando se venda (`AI_AVATAR_SE_VENDE`). */
export const NOMBRE_AI_AVATAR = 'Videos con una persona hecha con IA que habla por ti';

/** Lo demás que es sólo de Pro (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`), dicho igual. */

export const NOMBRE_FUNCION_PRO: Readonly<Record<FuncionSoloPro, string>> = {
  'scraper-whatsapp': 'Sumar a tu lista los contactos de tus grupos de WhatsApp',
};

export const GRUPOS_COMPARACION = [
  'Lo que entra en tu plan', 'Tu asistente con IA', 'Conseguir clientes', 'Anuncios', 'Contenido', 'Vender y cobrar', 'Atender',
  'Equipo', 'Recomendar MaKo', 'Acompañamiento',
] as const;

/** Los días gratis de cada plan (`planConPrueba`, lib/planes-mako.ts): desde el 12/11/2026, sólo Pro. */
const diasGratis = (id: string): Celda => (planConPrueba(id) ? `${PRUEBA_DIAS} días` : false);

export function filasDeComparacion(): FilaComparacion[] {
  const [entra, asistente, conseguir, anuncios, contenido, vender, atender, equipo, recomendar, acompanamiento] = GRUPOS_COMPARACION;
  return [
    filaDeTope(entra, 'Contactos guardados (interesados y clientes)', 'crm.leads', 'Hasta '),
    filaDeTope(entra, 'Tableros de ventas, para ver en qué paso está cada cliente', 'crm.funnels'),
    filaDeTope(entra, 'Números de WhatsApp conectados, más tu Instagram', 'chats.lineas_whatsapp'),
    filaDeTope(entra, 'Personas de tu equipo, cada una con su acceso', 'equipo.usuarios'),
    filaDeTope(entra, 'Seguimientos automáticos activos a la vez', 'automations.activas'),
    filaDeTope(entra, 'Páginas web para vender, publicadas', 'web.landings_publicadas'),
    filaDeTope(entra, 'Dominios propios para tus páginas (tunegocio.com)', 'web.dominios'),
    filaDeTope(entra, 'Cuentas para cobrar con Mercado Pago o Stripe', 'cobros.cuentas'),
    ...(PRUEBA_GRATIS_PRENDIDA ? [{ grupo: entra, que: 'Días gratis al empezar', esencial: diasGratis('esencial'), pro: diasGratis('pro'), acelerador: false }] : []),
    enTodos(asistente, 'MaKo, un asistente con IA que conoce tu negocio'),
    // Los referentes del chat de MaKo (lib/asesores/catalogo.ts), contados.
    enTodos(asistente, `Chat con ${ASESORES.length} referentes del marketing, con su método`),
    enTodos(asistente, 'Tus tareas, puntuadas y ordenadas por prioridad'),
    enTodos(asistente, 'Informes de tus ventas y de tus anuncios'),
    enTodos(conseguir, 'Páginas de venta y presentaciones armadas con IA'),
    enTodos(conseguir, 'Copiar una página que ya funciona, con tu oferta'),
    enTodos(conseguir, 'Tu oferta trabajada con IA, pieza por pieza'),
    enTodos(conseguir, 'Lo que publica tu competencia, en un solo lugar'),
    enTodos(conseguir, 'Regalos que piden el contacto: guías, checklists y quiz'),
    soloPro(conseguir, NOMBRE_FUNCION_PRO['scraper-whatsapp']),
    // Lo que en Esencial propone y no aplica solo (25/10/2026); cuántas ideas, del tope del plan.
    filaDeTope(anuncios, 'Ideas por día para mejorar tus anuncios', 'ads.recomendaciones_dia'),
    soloPro(anuncios, 'MaKo aplica las mejoras solo, sin pasarse de tu presupuesto'),
    enTodos(anuncios, 'Tus campañas de Meta, cruzadas con tus ventas'),
    enTodos(anuncios, 'Guiones de anuncios desde lo que compra tu cliente'),
    // AI Avatar está abierta en los tres planes desde el 29/10/2026 (Martín: «haz que AI-Avatar esté disponible para todos»), pero
    // la tabla no la vende hasta que ande de punta a punta (`AI_AVATAR_SE_VENDE`). Y el Video Generator, tampoco (29/10/2026).
    ...(AI_AVATAR_SE_VENDE ? [enTodos(contenido, NOMBRE_AI_AVATAR)] : []),
    enTodos(contenido, 'Textos con IA: guiones, emails y posteos'),
    enTodos(contenido, 'Un día de stories, con su guion cuadro por cuadro'),
    soloPro(contenido, NOMBRE_TAB_PRO['image-editor']),
    soloPro(contenido, NOMBRE_TAB_PRO['video-editor']),
    enTodos(vender, 'Cada contacto con su historia y su etapa de venta'),
    enTodos(vender, 'Tu agenda, con las reuniones de cada cliente'),
    enTodos(vender, 'Planes de pago en cuotas, con contrato y comprobantes'),
    soloPro(vender, NOMBRE_TAB_PRO['closing-analyst']),
    enTodos(atender, 'Todos tus chats en una sola bandeja'),
    enTodos(atender, 'Un agente con IA que contesta por WhatsApp e Instagram'),
    soloPro(equipo, 'Si eres agencia: los negocios de tus clientes'),
    // MaKo Partners, en todos los planes desde el 29/10/2026 (como lo dicen las landings).
    enTodos(recomendar, 'Ganar el primer mes de cada negocio que traes a MaKo'),
    // Sin «anuncios» (30/10/2026): lo que se arma la primera semana es lo de `PROGRAMA_ACELERADOR.incluye` y /reembolsos §2.
    soloPrograma(acompanamiento, 'Tu página, mensajes y seguimientos armados la primera semana'),
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
