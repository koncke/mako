// =============================================================================
// planes-mako — los planes que MaKo vende por su cuenta (lo puro: sin base ni red)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida».
// Hasta hoy un plan se vendía SÓLO armando el link a mano en /admin/cobros (el super admin tipeaba el precio). El
// checkout público de /planes necesita saber qué se vende, a cuánto y qué capa abre: eso vive acá.
//
// LAS OFERTAS (el Cerebro, 23/10/2026, docs/ofertas-mako.md): MaKo Esencial US$47/mes (US$470/año), MaKo Pro US$97/mes
// (US$970/año), y la Continuidad del Acelerador, US$297/mes (no se vende en /planes: se ofrece al terminar el programa).
// PARAMETRIZABLE: El super admin los cambia sin deploy con el setting `planes.mako` del workspace de
// la plataforma (lib/planes-mako-server.ts): el setting manda, y un plan mal escrito se descarta (nunca se vende un
// precio que no pasó `planesDeSetting`).
//
// ⚠️ LA CAPA SALE DEL PLAN, NUNCA DEL PEDIDO: el comprador elige un `id`; la capa, el precio y la moneda los pone esto.
// =============================================================================

import type { CapaId } from './capas';
import { TOPES } from './topes-plan';
import { PROMO_ENTRADA } from './promo-entrada-reglas';

// LO QUE SE LEE EN LA VITRINA (24/10/2026, Martín: «Lo hiciste con lenguaje interno, las personas no saben que es "Ops Center"
// y muchas otras cosas... Tienes que VENDER»). `resumen` dice para quién es según la etapa del negocio (como Kajabi: «¿ya
// vendes? escala») e `incluye`, lo que la persona CONSIGUE, sin nombres de tabs: ni «Ops Center», ni «Offer», ni «Closing
// Analyst». QUÉ incluye cada plan no cambió (docs/ofertas-mako.md): cambió cómo se dice. Los números salen de los topes que
// el código hace cumplir (lib/topes-plan.ts), nunca escritos a mano.
// Y SIN JERGA DE MARKETING (30/10/2026): Leila la había sacado el 27/10 de la tabla (lib/planes-comparacion.ts) y seguía en estas
// tarjetas, que es lo primero que se lee: «embudo», «CRM», «media buyer», «setter», «cohorte». La promesa y la garantía dicen lo
// mismo de antes, en palabras de quien no conoce el rubro. Lo fija tests/planes-tres-bloques.test.ts.
const T = TOPES;
const n = (v: number | null): string => (v == null ? 'sin tope' : v.toLocaleString('es-AR'));

export type PlanMako = {
  /** El id público (va en la URL: /planes/<id>). */
  id: string;
  nombre: string;
  /** La capa que abre el alta automática (tiene que ser vendible: lib/alta-cliente.ts lo vuelve a validar). */
  capa: CapaId;
  /** El precio mensual en dólares (Stripe cobra en USD). */
  precioUsd: number;
  /**
   * El precio mensual en la moneda de una cuenta de Mercado Pago (MP cobra en la moneda de SU sitio: ARS, MXN…). Sin
   * el precio en esa moneda, el plan no se ofrece por Mercado Pago (nunca se inventa una tasa).
   */
  preciosLocales: Record<string, number>;
  /** Una línea: para quién es. */
  resumen: string;
  /** Lo que incluye, en renglones cortos. */
  incluye: string[];
  destacado?: boolean;
  /** Un plan apagado no se ofrece en /planes, pero quien ya lo paga lo sigue pagando. */
  activo: boolean;
  /**
   * El precio por año (2 meses gratis: `MESES_GRATIS_ANUAL`). Desde el 25/10/2026 se muestra (el Cerebro) y SIEMPRE se pide:
   * el checkout cobra por mes, así que el anual deja el pedido en el CRM y se da de alta a mano (`periodo: 'anual'`).
   */
  precioAnualUsd?: number | null;
  /**
   * Lo que se le ofrece antes de darse de baja (docs/ofertas-mako.md, «Baja»): un descuento por meses, pausar meses gratis,
   * y/o pasar a otro plan más barato. Lo aplica lib/retencion-plan.ts.
   */
  retencion?: { descuento?: { pct: number; meses: number }; pausa?: { meses: number }; bajarA?: string } | null;
};

export const CLAVE_PLANES = 'planes.mako';

/** Cuántos meses regala el anual (US$470 = 10 × 47): lo más usado en el rubro (docs/como-venden-otros.md §6c). */
export const MESES_GRATIS_ANUAL = 2;

/**
 * LA PRUEBA GRATIS (25/10/2026, Martín: «quiero implementar la prueba gratuita de 7 días, y eliminar la garantia de
 * devolución... para darte de alta en la prueba gratuita debes poner la tarjeta, tal cual como una suscripción, y se te
 * cobra automático luego de esos 7 días»). Reemplaza a la garantía de 14/30 días, que se fue entera: después del primer
 * cobro, lo pagado no se devuelve. La dicen las tarjetas, las preguntas y /reembolsos §1, de esta constante.
 */
export const PRUEBA_DIAS = 7;

/**
 * ⚠️ PRENDIDA DE NUEVO EL 12/11/2026 (Martín: «Sí, préndela»): el botón de todo el sitio público es «Comienza tu prueba gratuita»
 * (app/vsl/_competencia/cta.ts) y ninguna página ofrece agendar una llamada. Lo de abajo es por qué se había apagado.
 * ⚠️ EL INTERRUPTOR DE LA PRUEBA GRATIS (30/10/2026, docs/estrategia-lanzamiento-low-to-high.md §4): APAGADA. No se borró: vuelve con
 * esto en true, el día que se venda MaKo como SaaS suelto. Es de la PLATAFORMA, no de cada negocio (el Cerebro): es cómo vende MaKo.
 * Los motivos de Martín, que deciden los bordes: 50% + prueba gratis se lee como sospechoso; la prueba es para vender un SaaS por
 * escalabilidad, y este funnel vende un high ticket; y con prueba hay que esperar siete días para saber si compraron, y no se
 * agenda una llamada con quien no pagó un peso.
 * ⚠️ A QUIEN YA ESTÁ EN PRUEBA NO SE LE TOCA NADA: esto apaga las altas nuevas. El cobro de una prueba abierta sigue siendo una prueba
 * (`esPruebaDePlan` mira el cobro, no este interruptor), con su aviso y su cobro del día 8.
 */
export const PRUEBA_GRATIS_PRENDIDA: boolean = true;

/**
 * LA PRUEBA, SÓLO EN PRO (12/11/2026, Martín: «como oferta para que vayan a la de 97 y no la de 47, ponerlo 7 días gratis ahí,
 * en la de 97… que para acceder a la de 47 haya que pagar directamente»). La prueba empuja hacia Pro: Esencial se paga al
 * empezar. Todo lo que dice o decide la prueba de UN plan pregunta aquí: las tarjetas (app/planes/Tarjetas.tsx), el checkout
 * (app/planes/[plan]/page.tsx) y el cobro (lib/compra-plan.ts, `comprarPlan`). El interruptor de arriba la apaga en todos.
 */
// Martín, 14/11/2026: «habilita nuevamente la prueba gratuita en el del 47… y evidentemente no la aclares por otro lado»: los
// dos planes empiezan con la prueba, y ningún texto aparte dice cuál sí y cuál no.
export const PLANES_CON_PRUEBA: readonly string[] = ['esencial', 'pro'];
export const planConPrueba = (id: string): boolean => PRUEBA_GRATIS_PRENDIDA && PLANES_CON_PRUEBA.includes(id);
/** El plan de la prueba, como lo nombran los textos generales («MaKo Pro empieza con 7 días gratis»). */
export const NOMBRE_PLAN_CON_PRUEBA = 'MaKo';

/** El descuento del primer mes, sobre los dos planes (§3). Con la prueba prendida no se ofrece: son una cosa o la otra. */
export const DESCUENTO_PRIMER_MES_PCT = PROMO_ENTRADA.pct;

/** Lo que va debajo del botón de un plan: cuánto se cobra después de la prueba y hasta cuándo se cancela sin pagar. */
export const textoDespuesDeLaPrueba = (montoUsd: number, periodo: 'mes' | 'año', prueba: boolean = PRUEBA_GRATIS_PRENDIDA): string =>
  prueba
    ? `Después US$ ${montoUsd.toLocaleString('es-AR')}/${periodo}. Cancela cuando quieras antes del día ${PRUEBA_DIAS + 1}.`
    : 'Pagas al empezar y cancelas cuando quieras.';

/** El precio del plan en pesos argentinos, si el plan lo tiene: nunca se calcula con una tasa (`preciosLocales`). */
export const precioEnPesos = (p: Pick<PlanMako, 'preciosLocales'>): number | null => {
  const v = p.preciosLocales?.ARS;
  return typeof v === 'number' && v > 0 ? v : null;
};

/** Los planes de hoy (23/10/2026). Cambiar acá es un deploy; cambiar el setting `planes.mako`, no. */
export const PLANES_MAKO_DEFAULT: readonly PlanMako[] = [
  {
    id: 'esencial',
    nombre: 'MaKo Esencial',
    capa: 'completo',
    precioUsd: 47,
    precioAnualUsd: 470,
    preciosLocales: {},
    resumen: 'Para empezar a vender por internet, por tu cuenta.',
    incluye: [
      'MaKo, tu asistente con IA, trabajando en tu negocio',
      `Hasta ${n(T.completo['crm.leads'])} contactos y ${n(T.completo['crm.funnels'])} tablero para ver en qué paso está cada cliente`,
      `${n(T.completo['chats.lineas_whatsapp'])} WhatsApp más Instagram, en una sola bandeja`,
      `Hasta ${n(T.completo['automations.activas'])} seguimientos automáticos y ${n(T.completo['web.landings_publicadas'])} páginas de venta`,
      // 29/10/2026: el avatar con IA NO va acá aunque la tab esté abierta en los tres planes: no se vende hasta que ande de punta a
      // punta (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts). Y un renglón no pasa de 80 letras: el setting `planes.mako` lo corta.
      'Tu oferta armada con IA, tu agenda, tus tareas y tus cobros',
      `${n(T.completo['ads.recomendaciones_dia'])} recomendaciones por día para mejorar tus anuncios, y tú decides si las aplicas`,
    ],
    activo: true,
    retencion: { pausa: { meses: 1 } },
  },
  {
    id: 'pro',
    nombre: 'MaKo Pro',
    capa: 'agencia',
    precioUsd: 97,
    precioAnualUsd: 970,
    preciosLocales: {},
    resumen: '¿Ya vendes? Para escalar con anuncios, contenido y equipo.',
    incluye: [
      // 29/10/2026: decía «sin topes», y Pro SÍ tiene (las líneas de WhatsApp y las personas, dos renglones más abajo, de
      // lib/topes-plan.ts). Gana el código: sin tope es lo que la tabla dice «Sin tope».
      'Todo lo de Esencial, sin tope de contactos, páginas ni seguimientos automáticos',
      // 29/10/2026 (el taller del Cerebro): crear campañas desde MaKo ya no existe, y los avatares con IA no se venden todavía
      // (`AI_AVATAR_SE_VENDE`). Lo que Pro suma: el media buyer que aplica solo y el Video Editor.
      'MaKo aplica solo las mejoras de tus anuncios, sin pasarse de tu presupuesto',
      'Qué mejorar en cada llamada de venta, con IA',
      // Y generar imágenes con IA no existe: el editor de imágenes sí (lib/planes-comparacion.ts, `NOMBRE_TAB_PRO`).
      'Edición de tus videos (silencios, ruido, subtítulos y cortes) y de tus imágenes',
      `Hasta ${n(T.agencia['chats.lineas_whatsapp'])} WhatsApp y ${n(T.agencia['equipo.usuarios'])} personas de tu equipo`,
      'Si eres agencia, los negocios de tus clientes en tu cuenta',
    ],
    destacado: true,
    activo: true,
    retencion: { descuento: { pct: 50, meses: 2 }, bajarA: 'esencial' },
  },
  {
    id: 'continuidad',
    nombre: 'Continuidad del Acelerador',
    capa: 'agencia',
    precioUsd: 297,
    preciosLocales: {},
    resumen: 'MaKo Pro y la asesoría grupal de Martín, al terminar el Acelerador.',
    incluye: ['MaKo Pro', 'La asesoría grupal en vivo de cada semana'],
    activo: false,
    retencion: { descuento: { pct: 50, meses: 2 }, bajarA: 'pro' },
  },
];

/**
 * El TERCER escalón de /planes (24/10/2026, Martín: «quiero ver los 3 bloques de pricing típicos que tiene toda app»): el
 * programa con Martín, docs/ofertas-mako.md §3. No es un `PlanMako`: no tiene capa propia ni se cobra por la pasarela; se
 * vende por llamada, como el «hablar con ventas» del tercer bloque de cualquier SaaS. La Continuidad (US$297) NO va en la
 * vitrina: se ofrece al terminar el programa, y al lado de Esencial y Pro un desconocido no sabría qué es.
 */
export type ProgramaMako = {
  id: string;
  nombre: string;
  precioUsd: number;
  /** En cuántas cuotas iguales se paga. */
  cuotas: number;
  resumen: string;
  incluye: string[];
  /** Lo que sigue al terminar, si quiere. */
  despues: { nombre: string; precioUsd: number };
  /**
   * La PROMESA de resultados (Martín, 24/10: «tiene que tener un factor de PROMESA de resultados, ya no solo software»).
   * Es un resultado con plazo, NO una garantía: lo que se devuelve está en `garantia`. null = no hay, y la vitrina no
   * inventa una.
   */
  promesa: string | null;
  /**
   * La garantía, sobre los ENTREGABLES y no sobre el resultado (como Ropofy: docs/como-venden-otros.md §6c). Una de
   * resultado recién cuando haya datos para medirla. El detalle (qué cuenta como «armado», qué se devuelve) está en
   * /reembolsos §2, y los dos tienen que decir lo mismo: lo fija tests/planes-tres-bloques.test.ts.
   */
  garantia: string | null;
};

/**
 * El tope de horas de la implementación de la semana 1 (25/10/2026, decidido por el Cerebro con docs/como-venden-otros.md
 * §6c: «entregables escritos con tope de horas», el molde de Mercately, que cobra US$1.499 con tope de 10 horas). Si
 * Martín lo cambia, se cambia acá y lo dicen la tarjeta y /reembolsos.
 */
export const HORAS_SEMANA_1 = 10;
/** Cuántas asesorías grupales en vivo trae el programa: una por semana, los 3 meses (docs/ofertas-mako.md §3). */
export const ASESORIAS_DEL_PROGRAMA = 12;

/**
 * LO QUE TE LLEVAS, EN EL CHECKOUT (14/11/2026, Martín: «en los bullet point… de qué incluye MaKo Pro, creo que eso está bastante viejo,
 * está mal. Piensa muy a profundidad qué poner ahí»). En el checkout se ve UN plan: «Todo lo de Esencial, más:» no dice nada ahí. Seis
 * renglones, en el orden de la portada (conseguir clientes → crear → anuncios → vender → el equipo), y sólo lo que ese plan trae de
 * verdad (la comparación de /planes, lib/planes-comparacion.ts: los editores de video e imagen, que MaKo aplique las mejoras de los
 * anuncios y los grupos de WhatsApp son de Pro). Sin jerga (ni «CRM» ni «embudo»): lo lee alguien que todavía no entró.
 */
export const INCLUYE_EN_EL_CHECKOUT: Readonly<Record<string, readonly string[]>> = {
  esencial: [
    'Lo que le funciona a tu competencia, en un solo lugar',
    'Páginas de venta, textos y guiones con tu oferta, escritos por IA',
    'Tus contactos ordenados solos, con todo lo que hace cada uno',
    'WhatsApp, Instagram y email en una sola bandeja',
    'Un agente con IA que contesta y lleva a agendar',
    'Hasta 2.000 contactos, 1 WhatsApp y 3 páginas de venta',
  ],
  pro: [
    'Lo que le funciona a tu competencia, replicado con tu oferta',
    'Tus videos editados y tus imágenes, sin salir de MaKo',
    'Tus anuncios revisados cada día, con las mejoras aplicadas',
    'Tus contactos ordenados solos, y WhatsApp, Instagram y email en una bandeja',
    'Un agente con IA que contesta y lleva a agendar',
    'Sin tope de contactos, con 3 WhatsApp y 5 personas de tu equipo',
  ],
};

export const PROGRAMA_ACELERADOR: ProgramaMako = {
  id: 'acelerador',
  nombre: 'MaKo Acelerador',
  precioUsd: 1500,
  cuotas: 3,
  resumen: 'Armamos contigo cómo consigues clientes y te acompañamos a vender. No es sólo la herramienta.',
  // Todo lo de docs/ofertas-mako.md §3, dicho entero: antes la tarjeta mostraba cinco renglones y se veía como «Pro más
  // caro» (Martín, 24/10: «el acompañamiento debe tener mas beneficios y verse diferencial, porque sino no tiene sentido»).
  // Cada entregable con su tope (§6c: «entregables escritos con tope de horas»): lo que se promete se puede contar.
  // 12/11/2026 (Martín: «tienen muchos ítems»): cada renglón corto, y MaKo Pro va en el título de la lista («Todo lo de MaKo
  // Pro los 3 meses, más:», app/planes/Tarjetas.tsx). Lo de cada entregable sigue entero en /reembolsos §2.
  incluye: [
    `Tu página, tu tablero de clientes, tus mensajes y tus seguimientos, armados la primera semana (hasta ${HORAS_SEMANA_1} horas de nuestro equipo)`,
    'Tu IA conectada y lista desde el primer día',
    `${ASESORIAS_DEL_PROGRAMA} asesorías grupales en vivo con Martín, una por semana, con su grabación`,
    'Plantillas probadas de páginas, mensajes y guiones',
    'Un grupo de WhatsApp con respuestas de Martín',
  ],
  despues: { nombre: 'Continuidad', precioUsd: 297 },
  // Martín, 14/11/2026 (la segunda vez, sus palabras): «en 90 días, Martín Koncke, el creador de MaKo, te instalará el sistema de
  // adquisición de clientes a la medida de tu oferta. Y podrás, como mínimo, rentabilizar la inversión que hiciste, garantizado por
  // contrato». Reemplaza a la de esa mañana («el sistema de ventas que armamos… las ventas que pagan el Acelerador») y a la del 25/10
  // («tus anuncios andando…»). El resultado (recuperar la inversión) lo garantiza el CONTRATO; `garantia` sigue siendo la de la entrega.
  promesa: 'En 90 días, Martín Koncke, el creador de MaKo, te instala el sistema de adquisición de clientes a la medida de tu oferta, y como mínimo recuperas la inversión que hiciste, garantizado por contrato.',
  garantia: 'Si al terminar la primera semana tu sistema de ventas no está armado, te devolvemos la cuota y no pagas las que siguen.',
};

const CAPAS_DE_PLAN: ReadonlySet<string> = new Set(['pm', 'completo', 'agencia']);
const ID_RE = /^[a-z0-9-]{1,32}$/;
const MONEDA_RE = /^[A-Z]{3}$/;

const texto = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};
const precio = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000_000 ? Math.round(n * 100) / 100 : null;
};

/** Un plan escrito a mano (el setting): o pasa entero, o no existe. */
export function planValido(v: unknown): PlanMako | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const nombre = texto(o.nombre, 60);
  const capa = typeof o.capa === 'string' ? o.capa : '';
  const usd = precio(o.precioUsd);
  if (!ID_RE.test(id) || !nombre || !CAPAS_DE_PLAN.has(capa) || usd == null) return null;
  const preciosLocales: Record<string, number> = {};
  if (o.preciosLocales && typeof o.preciosLocales === 'object' && !Array.isArray(o.preciosLocales)) {
    for (const [m, x] of Object.entries(o.preciosLocales as Record<string, unknown>)) {
      const p = precio(x);
      if (MONEDA_RE.test(m) && m !== 'USD' && p != null) preciosLocales[m] = p;
    }
  }
  const incluye = Array.isArray(o.incluye) ? o.incluye.map((x) => texto(x, 80)).filter((x): x is string => !!x).slice(0, 8) : [];
  return {
    id, nombre, capa: capa as CapaId, precioUsd: usd, preciosLocales,
    resumen: texto(o.resumen, 140) ?? '', incluye, destacado: o.destacado === true, activo: o.activo !== false,
    precioAnualUsd: precio(o.precioAnualUsd), retencion: retencionValida(o.retencion),
  };
}

/** La retención de un plan escrito a mano: lo que no pasa se tira (sin oferta, la baja va directo). */
function retencionValida(v: unknown): PlanMako['retencion'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const d = o.descuento as Record<string, unknown> | undefined;
  const p = o.pausa as Record<string, unknown> | undefined;
  const pct = Number(d?.pct), meses = Number(d?.meses), pausa = Number(p?.meses);
  const out: NonNullable<PlanMako['retencion']> = {};
  if (Number.isInteger(pct) && pct >= 10 && pct <= 90 && Number.isInteger(meses) && meses >= 1 && meses <= 6) out.descuento = { pct, meses };
  if (Number.isInteger(pausa) && pausa >= 1 && pausa <= 3) out.pausa = { meses: pausa };
  if (typeof o.bajarA === 'string' && ID_RE.test(o.bajarA)) out.bajarA = o.bajarA;
  return Object.keys(out).length ? out : null;
}

/**
 * Los planes que valen: los del setting si trae al menos uno bueno (sin ids repetidos), y si no, los de hoy. Un
 * setting roto NO deja la página sin planes ni vende uno a medio escribir.
 */
export function planesDeSetting(crudo: string | null | undefined): PlanMako[] {
  if (crudo) {
    try {
      const v = JSON.parse(crudo) as unknown;
      const lista = Array.isArray(v) ? v : [];
      const vistos = new Set<string>();
      const buenos: PlanMako[] = [];
      for (const x of lista) {
        const p = planValido(x);
        if (p && !vistos.has(p.id)) { vistos.add(p.id); buenos.push(p); }
      }
      if (buenos.length) return buenos;
    } catch { /* setting roto: los de hoy */ }
  }
  return PLANES_MAKO_DEFAULT.map((p) => ({ ...p, preciosLocales: { ...p.preciosLocales }, incluye: [...p.incluye], retencion: p.retencion ? { ...p.retencion } : null }));
}

/** El precio del plan en la moneda que cobra la pasarela: USD en Stripe, la del sitio en Mercado Pago. null = no se ofrece. */
export function precioEn(plan: PlanMako, moneda: string): number | null {
  const m = moneda.toUpperCase();
  if (m === 'USD') return plan.precioUsd;
  return plan.preciosLocales[m] ?? null;
}

/** El concepto del cobro (lo ve el comprador en el checkout y en su resumen de tarjeta). */
export const conceptoDelPlan = (plan: PlanMako): string => `${plan.nombre} · mensual`;
