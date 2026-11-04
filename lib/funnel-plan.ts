// =============================================================================
// El plan del funnel: un objeto guardado, no un mensaje del chat (1/11/2026)
// =============================================================================
// docs/funnel-coach.md §3: «Un chat puede fingir que te armó una oferta escribiéndola en un mensaje. No puede fingir un botón que la
// muestra». Lo guarda el Funnel Coach (operación `guardar_plan_funnel`) y lo muestra su botón «Ver el plan». Vive en app_settings del
// negocio: es uno por negocio y se reemplaza entero. Esta parte es pura; la lectura y la escritura están en lib/funnel-plan-db.ts.

export const CLAVE_PLAN_FUNNEL = 'funnel_coach.plan';

export const FUNNELS = ['anuncios', 'organico', 'youtube', 'anuncios-a-whatsapp', 'anuncios-a-vsl', 'prospeccion-en-frio'] as const;
export type Funnel = (typeof FUNNELS)[number];

export const ROTULO_FUNNEL: Readonly<Record<Funnel, string>> = {
  anuncios: 'Anuncios', organico: 'Orgánico', youtube: 'YouTube', 'anuncios-a-whatsapp': 'Anuncios a WhatsApp',
  'anuncios-a-vsl': 'Anuncios a VSL', 'prospeccion-en-frio': 'Scraping y prospección en frío',
};

export type PlanFunnel = {
  funnel: Funnel;
  /** Por qué ese y no otro, en lo que dijo la persona. */
  porque: string;
  /** Lo que invierte por mes, en dólares. null = todavía no lo dijo (un funnel orgánico puede no tenerlo). */
  presupuestoMensual: number | null;
  creativos: number | null;
  angulos: number | null;
  landings: number | null;
  pasos: string[];
  guardadoEn: string;
};

const TOPE_TEXTO = 600;
const TOPE_PASOS = 12;

const texto = (v: unknown, tope = TOPE_TEXTO): string => (typeof v === 'string' ? v.trim().slice(0, tope) : '');
const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Lo que llega de la herramienta o de la base: sin funnel válido no hay plan, y lo demás se limpia sin inventar nada. */
export function sanearPlan(v: unknown, guardadoEn?: string): PlanFunnel | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const funnel = FUNNELS.find((f) => f === o.funnel);
  if (!funnel) return null;
  const pasos = Array.isArray(o.pasos) ? o.pasos.map((p) => texto(p, 200)).filter(Boolean).slice(0, TOPE_PASOS) : [];
  return {
    funnel, porque: texto(o.porque), presupuestoMensual: numero(o.presupuestoMensual), creativos: numero(o.creativos), angulos: numero(o.angulos),
    landings: numero(o.landings), pasos, guardadoEn: guardadoEn ?? texto(o.guardadoEn, 40),
  };
}

/** Lo que se lee del plan: sólo lo que está. Un dato que no se dijo no ocupa una línea. */
export function lineasDelPlan(p: PlanFunnel): Array<{ rotulo: string; valor: string }> {
  const dato = (rotulo: string, n: number | null, conMoneda = false) => (n == null ? [] : [{ rotulo, valor: conMoneda ? `US$ ${n.toLocaleString('es-MX')}` : String(n) }]);
  return [
    { rotulo: 'Funnel', valor: ROTULO_FUNNEL[p.funnel] },
    ...dato('Inversión por mes', p.presupuestoMensual, true), ...dato('Creativos', p.creativos), ...dato('Ángulos', p.angulos), ...dato('Landings', p.landings),
  ];
}

/** Lo que el coach sabe de la oferta guardada en el negocio (lib/ofertas.ts → `listarOfertas`, la principal primero). */
export type OfertaGuardada = { nombre: string; desde_brief: boolean };
/** La oferta armada en una conversación de oferta y no guardada (lib/offer-sesiones.ts → `ofertaArmada`). */
export type OfertaArmada = { nombre: string; conversacion: string };

/**
 * CON QUÉ OFERTA ABRE EL COACH, Y DE DÓNDE SALE (4/11/2026, ticket #57). Martín, en el ws 9, leyó «Tu oferta ya está cargada» y
 * reportó la respuesta: hasta ese día era un sí o un no, y «no pude leer» contaba como sí (`hayOfertaParaElCoach`, el coach único
 * del mismo día). Ahora son tres estados, y el «hay» dice cuál es, para que la persona la corrija antes de seguir:
 *   · 'guardada'     — una oferta del negocio (la principal primero, como la lista `listar_ofertas`);
 *   · 'perfil'       — la que se siembra sola con el nombre que escribió en el onboarding (`desde_brief`, lib/ofertas.ts →
 *                      `seedOfertaDesdeBrief`): nadie la armó en Offer, y por eso se dice de dónde salió;
 *   · 'conversacion' — una armada en una conversación de oferta y sin guardar (lo que trabajaba el Offer Coach);
 *   · 'no-hay'       — se leyó y no hay ninguna;
 *   · 'no-se'        — la base no contestó: no se afirma ni que hay ni que falta.
 * Una lectura que falló llega como 'no-se'. Lo que sí se leyó manda: con una guardada, una armada ilegible no importa.
 */
export type OfertaDelCoach =
  | { estado: 'hay'; nombre: string; de: 'guardada' | 'perfil' | 'conversacion'; conversacion: string | null }
  | { estado: 'no-hay' }
  | { estado: 'no-se' };

/** El nombre que se muestra entre «»: sin las comillas de adentro, en un renglón y con tope. Vacío = no sirve para nombrarla. */
const TOPE_NOMBRE = 80;
function nombreParaDecir(v: string): string {
  const t = v.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(t);
  return chars.length > TOPE_NOMBRE ? `${chars.slice(0, TOPE_NOMBRE - 1).join('').trimEnd()}…` : t;
}

export function ofertaDelCoach(guardadas: readonly OfertaGuardada[] | 'no-se', armada: OfertaArmada | null | 'no-se'): OfertaDelCoach {
  const guardada = guardadas === 'no-se' ? null : guardadas.find((o) => nombreParaDecir(o.nombre));
  if (guardada) return { estado: 'hay', nombre: nombreParaDecir(guardada.nombre), de: guardada.desde_brief ? 'perfil' : 'guardada', conversacion: null };
  const armadaNombre = armada && armada !== 'no-se' ? nombreParaDecir(armada.nombre) || nombreParaDecir(armada.conversacion) : '';
  if (armada && armada !== 'no-se' && armadaNombre) {
    return { estado: 'hay', nombre: armadaNombre, de: 'conversacion', conversacion: nombreParaDecir(armada.conversacion) || null };
  }
  if (guardadas === 'no-se' || armada === 'no-se') return { estado: 'no-se' };
  return { estado: 'no-hay' };
}

/** Lo que llega del servidor (`GET /api/mako/chat?coaches`), sin confiar en la forma: lo que no se entiende es «no se sabe». */
export function sanearOfertaDelCoach(v: unknown): OfertaDelCoach {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  if (o.estado === 'no-hay') return { estado: 'no-hay' };
  if (o.estado === 'hay' && typeof o.nombre === 'string' && nombreParaDecir(o.nombre) && (o.de === 'guardada' || o.de === 'perfil' || o.de === 'conversacion')) {
    const conversacion = typeof o.conversacion === 'string' && nombreParaDecir(o.conversacion) ? nombreParaDecir(o.conversacion) : null;
    return { estado: 'hay', nombre: nombreParaDecir(o.nombre), de: o.de, conversacion };
  }
  return { estado: 'no-se' };
}

/** El renglón de la fila del coach en la lista: sin saber (o todavía sin respuesta), el que no afirma nada. */
export function previaDelCoach(o: OfertaDelCoach | null): string {
  return o?.estado === 'no-hay' ? 'Empieza por tu oferta' : 'Tu oferta y cómo conseguir clientes';
}

/** La pregunta que sigue a la oferta: el presupuesto (lib/asesores/contexto.ts, la fase 3). */
const PREGUNTA_PRESUPUESTO = '¿Cuánto puedes invertir por mes para conseguir clientes?';

/** El renglón que nombra la oferta: el mismo en el saludo y en el contexto del coach (`ofertaParaElContexto`). */
export function renglonDeLaOferta(o: Extract<OfertaDelCoach, { estado: 'hay' }>): string {
  if (o.de === 'perfil') return `Voy a usar «${o.nombre}», la oferta de tu perfil del negocio.`;
  if (o.de === 'conversacion') {
    return o.conversacion && o.conversacion !== o.nombre
      ? `Voy a usar «${o.nombre}», la oferta que armaste en la conversación «${o.conversacion}» y todavía no guardaste.`
      : `Voy a usar «${o.nombre}», la oferta que armaste y todavía no guardaste.`;
  }
  return `Voy a usar tu oferta «${o.nombre}».`;
}

/**
 * Lo que dice el chat vacío del coach (app/second-brain/useChatDelCoach.ts). No se guarda: es la portada. La oferta va primero
 * (lib/asesores/contexto.ts): sin ella, el coach la trabaja ahí mismo, sin mandar a ningún otro chat. Con una oferta, dice CUÁL en
 * un renglón y cómo cambiarla, y recién después pregunta el presupuesto. Sin poder leerlas, no afirma nada: pregunta.
 */
export function saludoDelFunnelCoach(o: OfertaDelCoach): string {
  if (o.estado === 'hay') return `${renglonDeLaOferta(o)} Si no es esa, dime cuál.\n\n${PREGUNTA_PRESUPUESTO}`;
  if (o.estado === 'no-se') return 'Empecemos por tu oferta: ¿qué vendes, a quién y a qué precio? Si ya tienes una guardada, dime cuál: ahora no pude ver tus ofertas.';
  return 'Empecemos por tu oferta: ¿qué vendes, a quién y a qué precio?';
}

/**
 * Lo mismo, para el MODELO (va en el contexto de cada turno del coach, app/api/mako/chat/route.ts). El saludo no se guarda en el
 * hilo: sin esto, a «no, es la otra» el coach no sabe de qué oferta le hablan.
 */
export function ofertaParaElContexto(o: OfertaDelCoach): string {
  if (o.estado === 'hay') {
    return `LA OFERTA CON LA QUE ABRISTE: al abrir el chat le dijiste: «${renglonDeLaOferta(o)} Si no es esa, dime cuál.» Si la persona dice que es otra, búscala con listar_ofertas (o en sus conversaciones de oferta) y trabaja con la que diga.`;
  }
  if (o.estado === 'no-se') return 'LA OFERTA: al abrir no se pudieron leer sus ofertas guardadas. Antes de dar una por cargada, míralas con listar_ofertas.';
  return 'LA OFERTA: no tiene ninguna guardada ni armada. Empieza por armarla con la persona (la fase 1).';
}
