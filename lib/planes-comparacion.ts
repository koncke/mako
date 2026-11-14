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

/** true = incluido, false = no incluido, texto = el tope. */
export type Celda = boolean | string;
export type FilaComparacion = { grupo: string; que: string; esencial: Celda; pro: Celda; acelerador: Celda };

const cantidad = (n: number | null, prefijo = ''): string => (n == null ? 'Sin tope' : `${prefijo}${n.toLocaleString('es-AR')}`);

/** Una fila de tope: Esencial es la capa `completo`; Pro y el Acelerador, `agencia`. */
// Un tope en 0 es «no lo trae» (14/11/2026: Esencial sin dominio propio): la celda va vacía, no «0».
const celdaDeTope = (n: number | null, prefijo: string): Celda => (n === 0 ? false : cantidad(n, prefijo));
const filaDeTope = (grupo: string, que: string, t: Tope, prefijo = ''): FilaComparacion => ({
  grupo,
  que,
  esencial: celdaDeTope(TOPES.completo[t], prefijo),
  pro: celdaDeTope(TOPES.agencia[t], prefijo),
  acelerador: celdaDeTope(TOPES.agencia[t], prefijo),
});
const enTodos = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: true, pro: true, acelerador: true });
const soloPro = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: false, pro: true, acelerador: true });
const soloPrograma = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: false, pro: false, acelerador: true });

/** Las tabs que son sólo de Pro, dichas como las nombra el marketing (nunca el nombre interno de la tab). */
export const NOMBRE_TAB_PRO: Readonly<Record<(typeof TABS_SOLO_PRO)[number], string>> = {
  'closing-analyst': 'Análisis de tus llamadas de venta con IA',
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
  'scraper-whatsapp': 'Scrapear los contactos de tus grupos de WhatsApp',
  'replicar-landing': 'Copiar la landing de un competidor, con tu oferta',
  // Lo que el candado cierra de verdad (lib/editores-ia-pro.ts): el chat con IA de cada editor, la edición automática, el B-roll y los
  // clips. Los subtítulos y quitar el fondo corren en el navegador y siguen en los dos planes: no se dicen acá.
  'ia-editores': 'Editar con IA: edición automática, B-roll y clips mágicos',
  'comunidad': 'Comunidad para tus alumnos, como en Skool',
  'setter-ia': 'Setter con IA que responde y agenda por WhatsApp e IG',
  'piloto-redes': 'Piloto automático de Instagram: publica y prueba hooks',
};

/** El piloto de YouTube: la misma función de Pro que el de Instagram ('piloto-redes'), en su propia fila. */
export const NOMBRE_PILOTO_YOUTUBE = 'Piloto automático de YouTube: Shorts y miniaturas';

/**
 * LOS GRUPOS (14/11/2026, el relevo de todo lo que hace MaKo; Martín: «hagas un relevo bien profundo de todo lo que hace MaKo…
 * lo agrupes mejor y seas más limitado en el de 47»). Por ÁREA, como se piensa un negocio: conseguir leads, el contenido y los
 * anuncios (juntos: «No entiendo la diferenciación con anuncios. Porque eso podrías agruparlo en contenido»), el CRM, los chats,
 * el área de miembros, la IA, el equipo y el acompañamiento. Cada tope va en su área (ya no hay un grupo «lo que entra»).
 */
// 14/11/2026, noche (Martín): sin «Equipo y agencia» (las cuentas de clientes y MaKo Partners no van; las personas del equipo, al
// CRM, para que no quede un grupo con una sola fila) y «Acompañamiento personalizado», con lo que promete.
export const GRUPOS_COMPARACION = [
  'Captación de leads', 'Contenido y anuncios', 'CRM y ventas', 'Chats y automatizaciones', 'Área de miembros', 'IA y reportes',
  'Acompañamiento personalizado',
] as const;

export function filasDeComparacion(): FilaComparacion[] {
  const [captacion, contenido, crm, chats, miembros, ia, acompanamiento] = GRUPOS_COMPARACION;
  return [
    // LENGUAJE DE MARKETING (14/11/2026, Martín: «no tengas problema en utilizar el lenguaje técnico de marketing… solo de
    // marketing»): landing, leads, CRM, pipelines, setter, scrapear. Lo que sigue prohibido es lo INTERNO de MaKo (el nombre de
    // una tab, «capa», «topes»): tests/planes-tres-bloques.test.ts.
    filaDeTope(captacion, 'Landings y presentaciones armadas con IA, publicadas', 'web.landings_publicadas'),
    filaDeTope(captacion, 'Dominio propio para tus landings (tunegocio.com)', 'web.dominios'),
    soloPro(captacion, NOMBRE_FUNCION_PRO['replicar-landing']),
    filaDeTope(captacion, 'Competidores que MaKo scrapea: web, redes y anuncios', 'spy.competidores'),
    soloPro(captacion, NOMBRE_FUNCION_PRO['scraper-whatsapp']),
    // AI Avatar está abierta en los tres planes desde el 29/10/2026 (Martín: «haz que AI-Avatar esté disponible para todos»), pero
    // la tabla no la vende hasta que ande de punta a punta (`AI_AVATAR_SE_VENDE`). Y el Video Generator, tampoco (29/10/2026).
    ...(AI_AVATAR_SE_VENDE ? [enTodos(contenido, NOMBRE_AI_AVATAR)] : []),
    // Los guiones de anuncios y las stories son plantillas de Copywriting (la tab Stories se deprecó el 29/10/2026).
    enTodos(contenido, 'Copywriting con IA: guiones de reels, anuncios, VSL y emails'),
    enTodos(contenido, 'Editor de imágenes y carruseles, como Canva'),
    enTodos(contenido, 'Editor de video, como CapCut'),
    soloPro(contenido, NOMBRE_FUNCION_PRO['ia-editores']),
    enTodos(contenido, 'Calendario de contenido y publicación en tus redes'),
    // Lo que en Esencial propone y no aplica solo (25/10/2026); cuántas, del tope del plan. Los tres pilotos automáticos, cada uno
    // en su fila y los tres de Pro (14/11/2026, noche, Martín). «ROAS real por campaña» se fue: no se entendía.
    filaDeTope(contenido, 'Recomendaciones por día para tus campañas de Meta', 'ads.recomendaciones_dia'),
    soloPro(contenido, 'Piloto automático de tus anuncios de Meta'),
    soloPro(contenido, NOMBRE_FUNCION_PRO['piloto-redes']),
    soloPro(contenido, NOMBRE_PILOTO_YOUTUBE),
    filaDeTope(crm, 'Leads y clientes guardados en tu CRM', 'crm.leads', 'Hasta '),
    filaDeTope(crm, 'Pipelines de venta en tu CRM, con sus etapas', 'crm.funnels'),
    enTodos(crm, 'Tracking de cada lead: de qué anuncio vino y qué hizo'),
    enTodos(crm, 'Agenda de llamadas sincronizada con Google, Calendly o Cal'),
    filaDeTope(crm, 'Cuentas de cobro conectadas: Mercado Pago o Stripe', 'cobros.cuentas'),
    enTodos(crm, 'Planes de pago en cuotas, con contrato y comprobantes'),
    soloPro(crm, NOMBRE_TAB_PRO['closing-analyst']),
    filaDeTope(crm, 'Personas de tu equipo, cada una con su acceso', 'equipo.usuarios'),
    enTodos(chats, 'Bandeja única: WhatsApp, Instagram, Messenger y email'),
    filaDeTope(chats, 'Números de WhatsApp conectados', 'chats.lineas_whatsapp'),
    filaDeTope(chats, 'Automatizaciones activas a la vez', 'automations.activas'),
    soloPro(chats, NOMBRE_FUNCION_PRO['setter-ia']),
    enTodos(chats, 'Email marketing: secuencias y envíos con tu dominio'),
    filaDeTope(miembros, 'Cursos con módulos y clases para tus alumnos', 'classroom.cursos'),
    soloPro(miembros, NOMBRE_FUNCION_PRO['comunidad']),
    enTodos(ia, 'MaKo, un asistente con IA que conoce tu negocio'),
    // Los referentes del chat de MaKo (lib/asesores/catalogo.ts), contados.
    enTodos(ia, `Chat con ${ASESORES.length} referentes del marketing, con su método`),
    enTodos(ia, 'Tu oferta y tu funnel, revisados con IA'),
    enTodos(ia, 'Reportes de tus ventas, tus anuncios y tu contenido'),
    enTodos(ia, 'Tus tareas, puntuadas y ordenadas por prioridad'),
    // Lo que promete el Acelerador (lib/planes-mako.ts, `PROGRAMA_ACELERADOR.promesa`), punto por punto, y lo que trae.
    soloPrograma(acompanamiento, 'Tu sistema de adquisición de clientes, instalado en 90 días'),
    soloPrograma(acompanamiento, 'A la medida de tu oferta, armado por Martín Koncke'),
    soloPrograma(acompanamiento, 'Recuperas como mínimo la inversión, garantizado por contrato'),
    // Sin «anuncios» (30/10/2026): lo que se arma la primera semana es lo de `PROGRAMA_ACELERADOR.incluye` y /reembolsos §2.
    soloPrograma(acompanamiento, 'Tu página, mensajes y seguimientos armados la primera semana'),
    soloPrograma(acompanamiento, 'La asesoría grupal en vivo con Martín, cada semana'),
    soloPrograma(acompanamiento, 'Plantillas probadas de páginas, mensajes y guiones'),
    soloPrograma(acompanamiento, 'Un grupo de WhatsApp con respuestas de Martín'),
  ];
}

/**
 * EL NOMBRE CORTO DE CADA FILA, para la tabla de /planes (14/11/2026, Martín: «se tiene que entender muy simple a qué hace
 * referencia»). El molde es Attio (notas: referencias-comparar/tablas-de-planes.md): el nombre de la cosa, de una a tres palabras,
 * en lenguaje de marketing; la frase entera (`que`) queda en el (i) de la fila. `que` no cambia: lo leen las tarjetas
 * («no incluye»), MaKo Partners y los tests.
 */
export function nombreCorto(que: string): string {
  const k: Record<string, string> = {
    'Landings y presentaciones armadas con IA, publicadas': 'Landings',
    'Dominio propio para tus landings (tunegocio.com)': 'Dominios propios',
    [NOMBRE_FUNCION_PRO['replicar-landing']]: 'Copiar landings de la competencia',
    'Competidores que MaKo scrapea: web, redes y anuncios': 'Competidores',
    [NOMBRE_FUNCION_PRO['scraper-whatsapp']]: 'Scrapear grupos de WhatsApp',
    [NOMBRE_AI_AVATAR]: 'Videos con tu avatar',
    'Copywriting con IA: guiones de reels, anuncios, VSL y emails': 'Copywriting con IA',
    'Editor de imágenes y carruseles, como Canva': 'Editor de imágenes',
    'Editor de video, como CapCut': 'Editor de video',
    [NOMBRE_FUNCION_PRO['ia-editores']]: 'Edición con IA',
    'Calendario de contenido y publicación en tus redes': 'Calendario de contenido',
    'Recomendaciones por día para tus campañas de Meta': 'Recomendaciones de ads',
    'Piloto automático de tus anuncios de Meta': 'Piloto automático de ads',
    [NOMBRE_FUNCION_PRO['piloto-redes']]: 'Piloto automático de Instagram',
    [NOMBRE_PILOTO_YOUTUBE]: 'Piloto automático de YouTube',
    'Leads y clientes guardados en tu CRM': 'Leads en el CRM',
    'Pipelines de venta en tu CRM, con sus etapas': 'Pipelines',
    'Tracking de cada lead: de qué anuncio vino y qué hizo': 'Tracking de leads',
    'Agenda de llamadas sincronizada con Google, Calendly o Cal': 'Agenda',
    'Cuentas de cobro conectadas: Mercado Pago o Stripe': 'Cuentas de cobro',
    'Planes de pago en cuotas, con contrato y comprobantes': 'Planes de pago',
    [NOMBRE_TAB_PRO['closing-analyst']]: 'Análisis de llamadas',
    'Bandeja única: WhatsApp, Instagram, Messenger y email': 'Bandeja de chats',
    'Números de WhatsApp conectados': 'Números de WhatsApp',
    'Automatizaciones activas a la vez': 'Automatizaciones activas',
    [NOMBRE_FUNCION_PRO['setter-ia']]: 'Setter con IA',
    'Email marketing: secuencias y envíos con tu dominio': 'Email marketing',
    'Cursos con módulos y clases para tus alumnos': 'Cursos',
    [NOMBRE_FUNCION_PRO['comunidad']]: 'Comunidad',
    'MaKo, un asistente con IA que conoce tu negocio': 'Asistente con IA',
    [`Chat con ${ASESORES.length} referentes del marketing, con su método`]: `Chat con ${ASESORES.length} referentes`,
    'Tu oferta y tu funnel, revisados con IA': 'Oferta y funnel con IA',
    'Reportes de tus ventas, tus anuncios y tu contenido': 'Reportes',
    'Tus tareas, puntuadas y ordenadas por prioridad': 'Tareas por prioridad',
    'Personas de tu equipo, cada una con su acceso': 'Usuarios',
    'Tu sistema de adquisición de clientes, instalado en 90 días': 'Sistema instalado en 90 días',
    'A la medida de tu oferta, armado por Martín Koncke': 'A la medida de tu oferta',
    'Recuperas como mínimo la inversión, garantizado por contrato': 'Garantía por contrato',
    'Tu página, mensajes y seguimientos armados la primera semana': 'Todo armado la semana 1',
    'La asesoría grupal en vivo con Martín, cada semana': 'Asesoría semanal con Martín',
    'Plantillas probadas de páginas, mensajes y guiones': 'Plantillas probadas',
    'Un grupo de WhatsApp con respuestas de Martín': 'Grupo con Martín',
  };
  return k[que] ?? que;
}

/** Los grupos en la tabla, en el orden de los datos (14/11/2026: uno por área; el título es el del grupo). */
export const GRUPOS_DE_LA_TABLA: ReadonlyArray<{ titulo: string; de: readonly string[] }> = GRUPOS_COMPARACION.map((g) => ({ titulo: g, de: [g] }));

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
