// =============================================================================
// topes-plan — lo que puede usar cada plan de MaKo (la tabla; hacerla cumplir es de cada área)
// =============================================================================
// Las ofertas del 23/10/2026 (docs/ofertas-mako.md): Esencial y Pro se diferencian por TOPES, no por funciones escondidas
// («el cliente ve todo MaKo desde el primer día»), copiado de Systeme.io. Esto es la tabla, declarativa como la de las
// tabs por capa (lib/capas.ts): el chat de cada área la LEE en el punto donde se crea la cosa (`topeDe(capa, 'crm.leads')`)
// y dice «llegaste al tope de tu plan» con el link a /planes.
//
// La clave es la CAPA (lo que el workspace ya tiene): Esencial = `completo`, Pro = `agencia` (lib/planes-mako.ts, en la rama
// de la suscripción). Un negocio sin plan vendido por la pasarela (el ws1, los acuerdos a mano) también tiene capa `completo`
// y NO se le aplican topes: quien hace cumplir uno pregunta primero si MaKo le cobra el plan por la pasarela
// (`suscripcionDeMakoDe(ws) != null`, lib/cobros.ts).
// =============================================================================

import type { CapaId } from './capas';

export type Tope =
  | 'crm.funnels' | 'crm.leads' | 'chats.lineas_whatsapp' | 'automations.activas' | 'web.landings_publicadas'
  | 'web.dominios' | 'cobros.cuentas' | 'equipo.usuarios'
  // El media buyer con IA (25/10/2026, el Cerebro): Esencial lo tiene en modo «propone», con 2 recomendaciones por día y sin
  // piloto automático (el cupo del plan de entrada de AdAmigo). Lo hace cumplir el chat «Media Buyer»; la vitrina lo lee acá.
  | 'ads.recomendaciones_dia'
  // 14/11/2026 (Martín: «Tu competencia solamente debería poder scrapear a una persona de la competencia, el de 97 ilimitado»):
  // los competidores que un negocio suma a Competitor Spy (lib/spy.ts, `agregarCompetidor`, la única entrada).
  | 'spy.competidores'
  // 14/11/2026 (Martín: «no pusiste nada de la parte de Classroom… seas más limitado en el de 47»): los cursos del Classroom.
  | 'classroom.cursos';

/** null = sin tope. */
export const TOPES: Readonly<Record<'completo' | 'agencia', Readonly<Record<Tope, number | null>>>> = {
  // MaKo Esencial (US$47)
  completo: {
    // 14/11/2026, noche (Martín, mirando /planes): 2 automatizaciones (eran 3) y SIN dominio propio (era 1; 0 = no se conecta).
    'crm.funnels': 1, 'crm.leads': 2000, 'chats.lineas_whatsapp': 1, 'automations.activas': 2,
    // 14/11/2026 (Martín: «landing… para el de 47 solamente puedo hacer una, para el de 97 ilimitado»): de 3 a 1. Quien ya tenía
    // más las conserva: el tope frena la próxima (lib/editor-landing/tope-landings.ts).
    'web.landings_publicadas': 1, 'web.dominios': 0, 'cobros.cuentas': 1, 'equipo.usuarios': 1,
    'ads.recomendaciones_dia': 2, 'spy.competidores': 1, 'classroom.cursos': 1,
  },
  // MaKo Pro (US$97): sin esos topes, con 3 líneas y 5 usuarios.
  agencia: {
    'crm.funnels': null, 'crm.leads': null, 'chats.lineas_whatsapp': 3, 'automations.activas': null,
    'web.landings_publicadas': null, 'web.dominios': null, 'cobros.cuentas': null, 'equipo.usuarios': 5,
    'ads.recomendaciones_dia': null, 'spy.competidores': null, 'classroom.cursos': null,
  },
};

/** Las tabs que son SÓLO del Pro (docs/ofertas-mako.md): una capa «esencial» que las esconda es del área de capas. */
// 25/10/2026: 'ads-manager' salió de acá: el Media Buyer es de los dos planes y lo que separa a Pro es el piloto automático y el
// cupo (ads.recomendaciones_dia), no la tab.
// 29/10/2026: 'ai-avatar' salió de acá. Martín: «haz que AI-Avatar esté disponible para todos» (los tres planes).
// 14/11/2026: 'image-editor' y 'video-editor' salieron de acá. Martín: «el editor de imágenes y editor de videos sí deberían estar
// disponibles para la versión de 47, pero no deberían estar disponibles el tema de editar con inteligencia artificial»: los
// editores son de los dos planes y lo de Pro es su IA (`FUNCIONES_SOLO_PRO`, 'ia-editores').
export const TABS_SOLO_PRO = ['closing-analyst'] as const;

/**
 * Lo que es SÓLO de Pro y no es una tab (27/10/2026, Martín en la llamada con Leila, Fathom 876470842-15): traer los contactos
 * de un grupo de WhatsApp (el scraper, app/crm/grupo-wa-actions.ts y la API) y hacerse MaKo Partner (`hacermePartner`,
 * lib/partners-programa.ts). Un Esencial que paga por la pasarela las ve con el candado y «Pasar a Pro» (`textoSoloPro`); la
 * vitrina lo dice en la tabla (lib/planes-comparacion.ts). Quien YA era partner antes del 27/10 sigue siéndolo.
 */
// MaKo Partners salió de acá el 29/10/2026: cualquier plan es partner (la llamada con Thiago, «una persona refiere a MaKo», y
// las landings, que dicen «gratis» y «cualquier plan»).
// 14/11/2026 (Martín, el relevo de lo que hace MaKo: «seas más limitado en el de 47»): copiar la landing de un competidor
// (Replicar del Web Generator y «Copiar su sitio» de Competitor Spy), la IA de los editores de imagen y de video, y la comunidad
// del Classroom. Cada una la hace cumplir su área con `esEsencialDe` / `esEsencialDeLaSesion` y dice `textoSoloPro`.
// 14/11/2026, noche (Martín): el setter con IA y los pilotos automáticos de Instagram y de YouTube, tampoco en Esencial (el de los
// anuncios ya era de Pro: lib/media-buyer/store.ts, `PlanSinPiloto`).
export const FUNCIONES_SOLO_PRO = ['scraper-whatsapp', 'replicar-landing', 'ia-editores', 'comunidad', 'setter-ia', 'piloto-redes'] as const;
export type FuncionSoloPro = (typeof FUNCIONES_SOLO_PRO)[number];

const QUE_ES_SOLO_PRO: Readonly<Record<FuncionSoloPro, string>> = {
  'scraper-whatsapp': 'Traer los contactos de un grupo de WhatsApp',
  'replicar-landing': 'Copiar la landing de otro negocio',
  'ia-editores': 'Editar con IA',
  'comunidad': 'La comunidad de tus alumnos',
  'setter-ia': 'El setter con IA',
  'piloto-redes': 'El piloto automático de Instagram y YouTube',
};
/** El texto del candado: qué es, que es de Pro y cómo tenerlo (con el botón a `RUTA_CAMBIAR_PLAN`). */
export const textoSoloPro = (f: FuncionSoloPro): string => `${QUE_ES_SOLO_PRO[f]} es de MaKo Pro. Pasa a Pro para usarlo.`;

// ── LA PRUEBA GRATIS (25/10/2026, el Cerebro) ─────────────────────────────────────────────────────────────────────
// Martín: «hay que evaluar que funciones le damos acceso en esos 7 días, porque de pronto se vienen y generan un montón de
// videos o cosas así y se dan de baja antes». Vale el plan elegido, con un tope en lo que alguien se puede LLEVAR y después
// irse. El resto del motor (CRM, automatizaciones, chats, Plan) anda entero: es lo que los hace quedarse. Lo hace cumplir
// cada pantalla con `frenoDePrueba` (lib/prueba-uso.ts), que dice `textoTopePrueba` con el botón a `RUTA_EMPEZAR_PLAN`.
//   · Los videos y las imágenes se generan con el Google Flow del CLIENTE (su cuenta, sus créditos): a MaKo casi no le
//     cuestan. El tope no es por costo: es por lo que se lleva sin pagar.
//   · «3 videos» son 3 ANUNCIOS armados (el montaje del Video Generator), y las tomas sueltas van aparte con 30 (unas 10
//     por anuncio): una toma se puede descargar sin armar el anuncio. Decidido acá sobre el pedido del Cerebro (que puso 3).

/** La marca de la prueba, como una capa más para `topeDe`. */
export const CAPA_PRUEBA = 'prueba';
export type TopePrueba = 'prueba.videos' | 'prueba.tomas' | 'prueba.avatares' | 'prueba.imagenes' | 'web.landings_publicadas' | 'prueba.exportar';
export const TOPES_PRUEBA: Readonly<Record<TopePrueba, number>> = {
  'prueba.videos': 3,
  'prueba.tomas': 30,
  'prueba.avatares': 1,
  'prueba.imagenes': 20,
  'web.landings_publicadas': 1,
  // Exportar o descargar en masa (el CSV de los leads): sólo después del primer cobro.
  'prueba.exportar': 0,
};

/** El tope de esa cosa para esa capa (o para la prueba, `CAPA_PRUEBA`). null = sin tope (también una capa que no es un plan). */
export function topeDe(capa: CapaId | string, tope: Tope | TopePrueba): number | null {
  if (capa === CAPA_PRUEBA) return (TOPES_PRUEBA as Record<string, number>)[tope] ?? null;
  const t = (TOPES as Record<string, Record<string, number | null>>)[capa];
  return t ? t[tope] ?? null : null;
}

/** El tope de un negocio EN PRUEBA: el menor entre el de su plan y el de la prueba. */
export function topeEnPrueba(capa: CapaId | string, tope: Tope | TopePrueba): number | null {
  const plan = topeDe(capa, tope), prueba = topeDe(CAPA_PRUEBA, tope);
  return plan == null ? prueba : prueba == null ? plan : Math.min(plan, prueba);
}

/** Lo que dice cada pantalla al llegar al tope de la prueba. Lo reconoce `esTopeDePrueba` para dibujar el botón. */
export const PREFIJO_TOPE_PRUEBA = 'Disponible al terminar tu prueba';
const QUE_TOPA: Readonly<Record<TopePrueba, (n: number) => string>> = {
  'prueba.videos': (n) => `en la prueba gratis van hasta ${n} ${n === 1 ? 'video armado' : 'videos armados'}`,
  'prueba.tomas': (n) => `en la prueba gratis van hasta ${n} tomas generadas`,
  'prueba.avatares': (n) => `en la prueba gratis va${n === 1 ? '' : 'n hasta'} ${n} ${n === 1 ? 'video' : 'videos'} con avatar de IA`,
  'prueba.imagenes': (n) => `en la prueba gratis van hasta ${n} imágenes generadas`,
  'web.landings_publicadas': (n) => `en la prueba gratis va${n === 1 ? '' : 'n hasta'} ${n} ${n === 1 ? 'página publicada' : 'páginas publicadas'}`,
  'prueba.exportar': () => 'exportar y descargar en masa se habilita con tu primer cobro',
};
// «El mismo lenguaje» que el cartel de la versión de prueba (25/10/2026, el Cerebro, copiado de Madgicx): «se habilita con tu plan».
export const textoTopePrueba = (tope: TopePrueba, n: number): string => `${PREFIJO_TOPE_PRUEBA}: ${QUE_TOPA[tope](n)}. Se habilita con tu plan.`;

/** Cómo se nombra cada cosa en la franja «Usaste 1 de 3 … de la prueba» (singular, plural). La exportación no cuenta. */
export const NOMBRE_COSA_PRUEBA: Readonly<Record<Exclude<TopePrueba, 'prueba.exportar'>, readonly [string, string]>> = {
  'prueba.videos': ['video armado', 'videos armados'],
  'prueba.tomas': ['toma', 'tomas'],
  'prueba.avatares': ['video con avatar de IA', 'videos con avatar de IA'],
  'prueba.imagenes': ['imagen', 'imágenes'],
  'web.landings_publicadas': ['página publicada', 'páginas publicadas'],
};
/** «1 de 3 videos armados»: lo que lleva la franja, con el plural del tope. */
export const usadoDePrueba = (tope: Exclude<TopePrueba, 'prueba.exportar'>, usado: number, de: number): string =>
  `${usado} de ${de} ${NOMBRE_COSA_PRUEBA[tope][de === 1 ? 0 : 1]}`;
export const esTopeDePrueba = (texto: string | null | undefined): boolean => typeof texto === 'string' && texto.startsWith(PREFIJO_TOPE_PRUEBA);

/** ¿Puede crear una más? `usadas` es lo que ya tiene. */
export const cabeOtra = (capa: CapaId | string, tope: Tope, usadas: number): boolean => {
  const t = topeDe(capa, tope);
  return t == null || usadas < t;
};

/**
 * LA ruta para «Pasar a Pro» (el Cerebro, 23/10/2026): todo cartel de tope lleva acá, nunca a una ruta propia. Es «Tu plan»
 * (app/configuraciones/plan), donde el negocio ve y cambia su plan.
 */
export const RUTA_CAMBIAR_PLAN = '/configuraciones/plan';

/** A dónde lleva el botón de un tope de la PRUEBA: «Tu plan», con «Empezar mi plan ya» a la vista. */
export const RUTA_EMPEZAR_PLAN = `${RUTA_CAMBIAR_PLAN}?empezar=1`;

export const textoTope = (t: number): string => `Llegaste al tope de tu plan (${t}). Pasa a MaKo Pro para tener más.`;
