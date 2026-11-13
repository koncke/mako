// =============================================================================
// compra-plan-reglas — lo que decide el checkout público de /planes (puro, con test)
// =============================================================================
// El servidor vive en lib/compra-plan.ts. Acá: qué se acepta del pedido (nada de precio ni de capa), cómo se limpia el
// ORIGEN que manda la landing y el código de MaKo Partners, qué pasarela se usa, y el diagnóstico del Acelerador.
// =============================================================================

import { CAPACIDADES_PASARELA, esPasarela, type Pasarela } from './cobros-tipos';
import { PREGUNTAS, type Pregunta } from './fase-diagnostico';
import { NOMBRE_PLAN_CON_PRUEBA, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA } from './planes-mako';
// De TIPO: se borra al compilar, así que no suma nada al bundle del cliente (esto lo importan componentes 'use client').
import type { MotivoDuplicado } from './leads-duplicados';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CODIGO_REF_RE = /^[a-z0-9-]{3,32}$/;

/**
 * De dónde vino quien compra. Lo manda la landing de MaKo («Landings de MaKo en Web Generator»): `landing` es el slug,
 * `avatar` a quién le habla y `funcionalidad` lo que vino a buscar (lo lee el onboarding). Más la campaña del anuncio.
 * Todo opcional, todo texto corto: es un dato que se MUESTRA y se usa para elegir una pantalla, nunca para cobrar.
 */
export type OrigenCompra = Partial<Record<(typeof CLAVES_ORIGEN)[number], string>>;

export const CLAVES_ORIGEN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const;
const TOPE_ORIGEN: Record<(typeof CLAVES_ORIGEN)[number], number> = {
  landing: 64, avatar: 40, funcionalidad: 40, utm_source: 100, utm_medium: 100, utm_campaign: 150, utm_content: 150, fbclid: 250,
};
/** Lo que puede venir en `landing`, `avatar` y `funcionalidad`: un slug. La campaña es texto libre (sin control). */
const SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/;

/** El origen limpio, o null si no trae nada que valga. Las claves que no son de la lista se tiran. */
export function origenLimpio(v: unknown): OrigenCompra | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: OrigenCompra = {};
  for (const k of CLAVES_ORIGEN) {
    const crudo = typeof o[k] === 'string' ? (o[k] as string).trim() : '';
    if (!crudo) continue;
    // Sin caracteres de control (un salto de línea en un dato que después se escribe en un mail o en un log).
    // eslint-disable-next-line no-control-regex
    const s = crudo.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, TOPE_ORIGEN[k]);
    if (!s) continue;
    if ((k === 'landing' || k === 'avatar' || k === 'funcionalidad')) {
      const slug = s.toLowerCase();
      if (!SLUG_RE.test(slug)) continue;
      out[k] = slug;
    } else out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/** El código de MaKo Partners del pedido (o de la cookie), en minúscula. null si no es uno. */
export function codigoRefLimpio(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return CODIGO_REF_RE.test(s) ? s : null;
}

// =============================================================================
// EL DIAGNÓSTICO DE 2 MINUTOS, la puerta del Acelerador (25/10/2026)
// =============================================================================
// docs/como-venden-otros.md §6c, el molde de Ropofy: «un diagnóstico de 2 minutos como puerta, más la llamada». Antes de
// dejar sus datos, quien pide el Acelerador contesta tres preguntas, una por pantalla, y la llamada arranca sabiendo dónde
// está su negocio. Son las MISMAS del diagnóstico de fase del onboarding (lib/fase-diagnostico.ts), no unas escritas acá:
// docs/embudo-y-high-ticket.md §6 califica la llamada por facturación y por cuello, con esos mismos tramos. Lo que se
// guarda es el TEXTO de la opción (el índice solo no dice nada en el CRM), y nunca lo que escribió el navegador.

export const PREGUNTAS_DE_LA_PUERTA: readonly Pregunta[] = ['facturacion', 'inversion', 'cuello']
  .map((id) => PREGUNTAS.find((p) => p.id === id)!);
/** Cómo se nombra cada respuesta en el historial del lead y en el aviso al equipo. */
const ROTULO_DE_LA_PUERTA: Record<string, string> = {
  facturacion: 'Factura por mes', inversion: 'Invierte por mes en conseguir clientes', cuello: 'Su mayor traba',
};
export type RespuestaDePuerta = { rotulo: string; respuesta: string };

/** Las respuestas del diagnóstico (`{ facturacion: 1, … }`, el índice de cada opción): las tres, o null. */
export function diagnosticoLimpio(v: unknown): RespuestaDePuerta[] | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: RespuestaDePuerta[] = [];
  for (const p of PREGUNTAS_DE_LA_PUERTA) {
    const i = o[p.id];
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= p.opciones.length) return null;
    out.push({ rotulo: ROTULO_DE_LA_PUERTA[p.id], respuesta: p.opciones[i] });
  }
  return out;
}

/** El diagnóstico en un renglón, para el historial del lead y el aviso: «Factura por mes: $3.000 – $10.000 · …». */
export function diagnosticoEnTexto(d: readonly RespuestaDePuerta[]): string {
  return d.map((x) => `${x.rotulo}: ${x.respuesta}`).join(' · ');
}

export type PedidoCompra = {
  plan: string; nombre: string; email: string; pasarela: Pasarela | null; origen: OrigenCompra | null; ref: string | null;
  /**
   * El WhatsApp (sólo dígitos). En el pedido sin pasarela es obligatorio: por ahí se le da de alta. En la compra se pide y no frena el
   * pago (31/10/2026, Martín: «que le pida también el whatsapp»): vacío, compra igual. `whatsappEscritoMal`: escribió algo que no
   * puede ser un número; se le dice, como a un código de referido mal escrito, y dejarlo vacío sigue.
   */
  whatsapp: string | null;
  whatsappEscritoMal?: boolean;
  /** true = «lo quiero» sin pasarela: deja el pedido en el CRM, no abre un pago (`pedirPlanSinPasarela`). */
  quiero: boolean;
  /** El diagnóstico de la puerta (sólo lo manda el pedido del Acelerador). Incompleto = null: el pedido entra igual. */
  diagnostico: RespuestaDePuerta[] | null;
  /** Por mes o por año (25/10/2026). El anual SIEMPRE se pide: el checkout cobra por mes. */
  periodo: 'mensual' | 'anual';
  /**
   * Empezar SIN la prueba gratis (25/10/2026): la salida de quien ya la usó con ese email. El plan se cobra desde hoy. Sin
   * pedirlo, toda compra en línea empieza con los 7 días gratis.
   */
  sinPrueba: boolean;
  /** La página le mostró el 50% del primer mes: si ya no vale, se le dice en vez de cobrarle lleno. El reloj lo mira la ruta, con su cookie. */
  promo?: boolean;
  /** Quien ya supo que su descuento no vale y sigue a precio normal. Sin esto, nunca se le cobra lleno sin decírselo. */
  sinPromo?: boolean;
  /**
   * El código de referido que la persona ESCRIBIÓ en el carrito (25/10/2026, Martín: «es importante que en la compra, en el
   * carrito, esté la opción de poner código de referido»). Escrito a mano, gana sobre la cookie y el `?ref=`: es quien paga
   * diciendo quién lo trajo. `codigoEscritoMal`: escribió algo que no puede ser un código (se le dice, no se descarta).
   */
  codigoEscrito: string | null;
  codigoEscritoMal: boolean;
};

/** Lo que se le dice a quien escribe un código de referido que no es de ningún partner. */
export const TEXTO_CODIGO_NO_EXISTE = 'Ese código de referido no existe. Revísalo, o deja el campo vacío para seguir.';

/** Lo que se le dice a quien escribe un WhatsApp que no puede ser un número. Nunca frena la compra: vacío, sigue. */
export const TEXTO_WHATSAPP_MAL = 'Ese WhatsApp no parece completo. Revísalo, o deja el campo vacío para seguir.';

/**
 * Qué código de partner vale en una compra: el que ESCRIBIÓ en el carrito; si no escribió ninguno, el de la cookie de
 * /r/<código> (el primer link que abrió, revisión del 23/10: la cookie gana sobre el `?ref=` de la URL); y si no, el `?ref=`.
 */
export const codigoDeLaCompra = (p: { escrito: string | null; cookie: string | null; url: string | null }): string | null =>
  p.escrito ?? p.cookie ?? p.url;

/**
 * EL CÓDIGO QUE SE GUARDA EN EL COBRO (28/10/2026, la verificación de 3ca2d8328): el escrito ya se validó (o no se pudo leer y
 * sigue); el que trajo un LINK (`elegido`: la cookie de /r/<código> o el `?ref=`), sólo si es de un partner. Antes entraba sin
 * mirar, y con el código editable un partner podía ELEGIR después ese texto (`promo-octubre`) y llevarse el crédito de una compra
 * que no trajo. Primero la cookie y después el `?ref=` (el primero que lo trajo gana, `codigoDeLaCompra`); una cookie de nadie no
 * tapa el `?ref=` de un partner. ⚠️ Si no se puede LEER (la verificación de a196d5a93): la cookie vale (la dejó /r/<código>, que ya
 * la validó con `codigoVigente`) y el `?ref=` crudo se descarta: guardarlo «por las dudas» era otra vez el código huérfano.
 */
export async function codigoQueCuenta(
  p: { escrito: string | null; cookie: string | null; url: string | null }, esDePartner: (codigo: string) => Promise<boolean>,
): Promise<string | null> {
  if (p.escrito) return p.escrito;
  for (const [x, siNoSePuedeLeer] of [[p.cookie, true], [p.url, false]] as const) {
    if (x && (await esDePartner(x).catch(() => siNoSePuedeLeer))) return x;
  }
  return null;
}

/** El texto del pedido del anual que llega como compra (sin `quiero`): no hay checkout anual, y no se cobra un mes en su lugar. */
export const TEXTO_ANUAL_SE_PIDE = 'El plan anual se pide con tus datos: te escribimos por WhatsApp para darte de alta.';

/**
 * El pedido del formulario, validado. Lo que NUNCA sale de acá: el precio, la moneda y la capa (los pone el plan). El
 * campo trampa (`web`) lleno es un bot: se contesta como si nada (quien llama no crea nada).
 */
export function leerPedidoCompra(body: unknown): { ok: true; pedido: PedidoCompra } | { ok: false; error: string; bot?: true } {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.web === 'string' && b.web.trim()) return { ok: false, error: 'bot', bot: true };
  const plan = typeof b.plan === 'string' ? b.plan.trim() : '';
  if (!/^[a-z0-9-]{1,32}$/.test(plan)) return { ok: false, error: 'Ese plan no existe.' };
  const nombre = (typeof b.nombre === 'string' ? b.nombre : '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (nombre.length < 2) return { ok: false, error: 'Escribe tu nombre.' };
  const email = (typeof b.email === 'string' ? b.email : '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: 'Escribe un email válido: por ahí te llega el acceso.' };
  // Por el guard compartido, no por los dos nombres a mano (31/10/2026): con la lista escrita acá, quien elegía Creem
  // en /planes/<id> mandaba `pasarela: 'creem'` y el server lo leía como «no eligió ninguna».
  const pasarela = esPasarela(b.pasarela) ? b.pasarela : null;
  const quiero = b.quiero === true;
  const whatsapp = whatsappLimpio(b.whatsapp);
  if (quiero && !whatsapp) return { ok: false, error: 'Escribe tu WhatsApp con el código de país: por ahí te damos de alta.' };
  const periodo = b.periodo === 'anual' ? 'anual' : 'mensual';
  if (periodo === 'anual' && !quiero) return { ok: false, error: TEXTO_ANUAL_SE_PIDE };
  return {
    ok: true,
    pedido: {
      plan, nombre, email, pasarela, origen: origenLimpio(b.origen), ref: codigoRefLimpio(b.ref), whatsapp, quiero,
      // Con la lada ya elegida, 8 dígitos dejan pasar un número a medias (+54 y «112233»): ningún WhatsApp del mundo tiene menos de 10 con su país.
      whatsappEscritoMal: !quiero && typeof b.whatsapp === 'string' && b.whatsapp.trim() !== '' && (whatsapp ?? '').length < 10,
      diagnostico: diagnosticoLimpio(b.diagnostico), periodo, sinPrueba: b.sinPrueba === true,
      promo: b.promo === true, sinPromo: b.sinPromo === true,
      codigoEscrito: codigoRefLimpio(b.codigo),
      codigoEscritoMal: typeof b.codigo === 'string' && b.codigo.trim() !== '' && codigoRefLimpio(b.codigo) == null,
    },
  };
}

/**
 * Con qué pasarela se cobra: la que eligió (si está conectada y el plan tiene precio en su moneda), o la única que sirve.
 * Con dos que sirven y ninguna elegida, se pregunta (null + `elegir`).
 */
export function pasarelaDeLaCompra(p: {
  pedida: Pasarela | null;
  sirven: readonly Pasarela[];
}): { ok: true; pasarela: Pasarela } | { ok: false; motivo: 'sin-pasarela' | 'elegir' | 'no-sirve' } {
  if (!p.sirven.length) return { ok: false, motivo: 'sin-pasarela' };
  if (p.pedida) return p.sirven.includes(p.pedida) ? { ok: true, pasarela: p.pedida } : { ok: false, motivo: 'no-sirve' };
  return p.sirven.length === 1 ? { ok: true, pasarela: p.sirven[0] } : { ok: false, motivo: 'elegir' };
}

// =============================================================================
// LA PASARELA SEGÚN EL PAÍS (27/10/2026, llamada con Leila, Fathom 876470842)
// =============================================================================
// En vivo, una clienta de México recibió el link de la Mercado Pago de MaKo y MP la rechazó: «No se puede continuar con este
// pago. La cuenta del vendedor es de otro país». Mercado Pago cobra sólo dentro del país de SU cuenta (la de MaKo es
// argentina: cobra en ARS). Así que Mercado Pago se ofrece sólo a quien está en ese país, y ahí es la ÚNICA (en pesos, sin
// el recargo de la tarjeta internacional: docs/estrategia-financiera-mako.md); en el resto del mundo, Stripe. Sin saber el
// país (sin el encabezado de Vercel: local, o una IP que Vercel no ubica), las dos, y elige la persona.

/** El país de cada sitio de Mercado Pago, por la moneda en que cobra su cuenta. */
const PAIS_DE_MERCADO_PAGO: Readonly<Record<string, string>> = { ARS: 'AR', MXN: 'MX', BRL: 'BR', CLP: 'CL', COP: 'CO', PEN: 'PE', UYU: 'UY' };

/** El país del visitante (el encabezado `x-vercel-ip-country`, dos letras), o null si no se sabe. */
export function paisDelVisitante(encabezado: string | null | undefined): string | null {
  const p = String(encabezado ?? '').trim().toUpperCase();
  // XX = Vercel no lo ubicó; T1 = Tor (convención de Cloudflare, por si el encabezado viene de un proxy).
  return /^[A-Z]{2}$/.test(p) && p !== 'XX' && p !== 'T1' ? p : null;
}

/**
 * LATINOAMÉRICA, para elegir entre un MERCHANT OF RECORD y Stripe afuera del país de Mercado Pago (31/10/2026).
 *
 * Un merchant of record (era Creem) cobra el impuesto del país de quien paga, lo remite él y le da una factura que cumple.
 * Stripe no: el impuesto queda del lado de MaKo. En LatAm eso es la diferencia entre un cobro limpio y un lío fiscal por
 * cada país, así que acá manda el que lo sea. Afuera de LatAm sigue Stripe, que es lo que ya estaba andando.
 *
 * ⚠️ DESDE EL 5/11/2026 NO HAY NINGUNO: Creem rechazó la tienda de MaKo (docs/creem-retiros.md) y la plataforma ya no tiene
 * sus claves. LatAm fuera del país de Mercado Pago queda con Stripe si está conectado, y si no, sin pasarela: la página del
 * plan pide los datos (`TEXTO_SIN_PASARELA`) y la compra los toma como pedido (lib/compra-plan.ts), nunca un error. La
 * preferencia se pregunta por CAPACIDAD (`merchantOfRecord`), no por el nombre: la próxima pasarela que lo sea entra sola.
 */
const PAISES_LATAM: ReadonlySet<string> = new Set([
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
]);

/**
 * Las pasarelas que se le ofrecen a quien está en `pais`. Mantiene el orden y los datos de cada opción.
 *
 * EL ORDEN DE LAS PREGUNTAS:
 *   1. ¿Mercado Pago cobra en SU país? Entonces es la única: en pesos, sin el recargo de la tarjeta internacional
 *      (a un argentino, US$47 con tarjeta de afuera le salen el equivalente a US$71 por IVA y percepciones).
 *   2. Si no: en LatAm, la que sea merchant of record (se hace cargo del impuesto; era Creem, hoy ninguna); en el resto
 *      del mundo, la que no lo es (Stripe).
 *   3. Y si la que le toca no está conectada, lo que quede. Nunca se deja a alguien sin forma de pagar por una
 *      preferencia nuestra: eso sería perder la venta para ahorrarnos un impuesto.
 *
 * ⚠️ ASÍ ESTABA ESCRITO ANTES, Y ES LA TRAMPA QUE ESTE ARCHIVO EXISTE PARA CONTAR:
 *       `return locales.length ? locales : opciones.filter((o) => o.pasarela !== 'mercadopago');`
 *    Ese `!== 'mercadopago'` quería decir «Stripe», y con dos pasarelas quería decir exactamente eso. Con tres dejó
 *    de querer decirlo: devuelve Stripe Y Creem juntos, a todo el mundo. Y como las dos son opciones válidas, nadie
 *    falla — lo que pasa es que a quien compra se le PREGUNTA con qué quiere pagar (`pasarelaDeLaCompra` devuelve
 *    'elegir' con más de una), o sea una pantalla de más y una decisión que no le toca tomar a él. Un `!==` que
 *    significa «el otro» es correcto sólo mientras haya dos.
 */
export function pasarelasDelPais<T extends { pasarela: Pasarela; moneda: string }>(pais: string | null, opciones: readonly T[]): T[] {
  // Sin saber el país (local, o una IP que Vercel no ubica), todas, y elige la persona.
  if (!pais) return [...opciones];
  const locales = opciones.filter((o) => o.pasarela === 'mercadopago' && PAIS_DE_MERCADO_PAGO[o.moneda.toUpperCase()] === pais);
  if (locales.length) return locales;
  // Las que cobran en todo el mundo: nunca la que sólo cobra en el país de su cuenta (Mercado Pago), que afuera rechaza.
  const internacionales = opciones.filter((o) => !CAPACIDADES_PASARELA[o.pasarela].soloEnSuPais);
  const enLatam = PAISES_LATAM.has(pais);
  const suyas = internacionales.filter((o) => CAPACIDADES_PASARELA[o.pasarela].merchantOfRecord === enLatam);
  if (suyas.length) return suyas;
  // La que le tocaba no está conectada (hoy, en LatAm, siempre: no hay merchant of record): las internacionales que queden.
  // Y si no queda ninguna, ninguna: la página pide los datos.
  return internacionales;
}

/**
 * Lo que se le ofrece a quien compra: las pasarelas REALES según su país (`pasarelasDelPais`) y, sólo para el super admin, las
 * que están en modo PRUEBA sin el filtro del país (11/11/2026). La prueba de humo de una pasarela nueva la hace el super admin
 * desde Argentina; con el filtro, en Argentina con Mercado Pago la Stripe de prueba quedaba tapada y no se podía probar. Una
 * pasarela que está real y de prueba a la vez se ofrece una sola vez, la real. Al público, `dePrueba` llega vacía.
 */
export function pasarelasParaOfrecer<T extends { pasarela: Pasarela; moneda: string }>(pais: string | null, reales: readonly T[], dePrueba: readonly T[]): T[] {
  const segunPais = pasarelasDelPais(pais, reales);
  const yaEstan = new Set(reales.map((o) => o.pasarela));
  return [...segunPais, ...dePrueba.filter((o) => !yaEstan.has(o.pasarela))];
}

// =============================================================================
// SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Hasta que Martín conecte la pasarela de MaKo (/integraciones?ws=9), ningún plan se puede pagar en línea. /planes
// prometía «entras en el acto» con un botón «Empezar», y el paso siguiente decía «Escríbenos» sin dar a dónde: un
// callejón. Se decide POR PLAN y con la misma cuenta que el checkout (lib/compra-plan.ts, `ofertasDeLosPlanes`): un plan
// sin precio en la moneda de la pasarela tampoco se cobra.
//
// LA SALIDA YA NO ES LA AGENDA (24/10/2026, Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing
// de las ofertas»). El botón lleva a la página del plan, y ahí, sin pasarela, la persona deja su nombre, su email y su
// WhatsApp: queda como lead en el CRM de MaKo con el plan, el origen de la campaña y el código de partner
// (lib/compra-plan.ts, `pedirPlanSinPasarela`), y se le da de alta a mano. Es mejor atribución que la agenda: el código de
// partner viaja en el mismo pedido.

export const TEXTO_SIN_PASARELA = 'Todavía no cobramos en línea. Déjanos tus datos y te escribimos por WhatsApp para darte de alta.';

/** El botón de un plan: comprar si se puede cobrar; si no, pedirlo en su página (nunca «Empezar» sin cobro detrás). */
export function botonDelPlan(p: { id: string; nombre: string; cobrable: boolean; sufijo: string }): { href: string; texto: string } {
  return { href: `/planes/${p.id}${p.sufijo}`, texto: p.cobrable ? `Empezar con ${p.nombre}` : `Quiero ${p.nombre}` };
}

/** El botón del anual: siempre «Quiero» (se pide), con el origen y el partner del sufijo más `periodo=anual`. */
export function botonAnualDelPlan(p: { id: string; sufijo: string }): { href: string; texto: string } {
  const sufijo = p.sufijo.startsWith('?') ? `${p.sufijo}&periodo=anual` : '?periodo=anual';
  return { href: `/planes/${p.id}${sufijo}`, texto: 'Quiero el anual' };
}

/** La bajada de /planes: «entras en el acto» sólo si algún plan se puede pagar en línea. */
export function bajadaDePlanes(algunoCobrable: boolean, prueba: boolean = PRUEBA_GRATIS_PRENDIDA): string {
  if (!prueba) {
    return algunoCobrable
      ? 'Pagas al empezar y entras en el acto. Te das de baja cuando quieras.'
      : 'Elige tu plan y déjanos tus datos: te damos de alta por WhatsApp. Te das de baja cuando quieras.';
  }
  // La prueba es sólo de Pro desde el 12/11/2026 (`planConPrueba`): la bajada lo dice.
  return algunoCobrable
    ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis, y entras en el acto. Te das de baja cuando quieras.`
    : `Elige tu plan y déjanos tus datos: te damos de alta por WhatsApp (${NOMBRE_PLAN_CON_PRUEBA}, con ${PRUEBA_DIAS} días gratis). Te das de baja cuando quieras.`;
}

/**
 * El WhatsApp del pedido: sólo dígitos (con el código de país), de 8 a 15 (E.164). null = no sirve. No se
 * inventa el país: lo que la persona no escribió no se agrega.
 */
export function whatsappLimpio(v: unknown): string | null {
  const d = (typeof v === 'string' ? v : '').replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/**
 * ¿De estos parecidos, cuál ES el comprador? (30/10/2026) El mismo email, sí. El mismo teléfono o Instagram, si esa ficha no tiene otro email.
 * Por nombre sólo si es UNO y no tiene email: lo cargó alguien a mano antes de que comprara. Con otro email es un homónimo, y la compra no
 * se le ata a otra persona.
 *
 * ⚠️ OTRO EMAIL Y EL MISMO NÚMERO (31/10/2026): con el WhatsApp en el checkout, ese número lo escribe cualquiera en un formulario público. Atarle
 * la compra a esa ficha la marca Ganado y le pisa la cuenta (`asentarAlta`): un dígito mal, o el dueño que compra para su segundo negocio.
 * Se crea otra ficha, que se funde después si eran la misma persona.
 */
/**
 * ¿Un parecido de ESTE motivo le ata la compra a esa ficha? Es una decisión de PLATA, así que es un `Record` TOTAL: un
 * motivo nuevo de `buscarDuplicados` NO COMPILA hasta que alguien diga qué hace con el dinero de otra persona
 * (31/10/2026). Antes la condición era `c.motivo !== 'nombre'`, o sea un `else` con todo adentro: cuando se sumó
 * 'instagram' entró solo en «le ata la compra», sin que nadie lo decidiera.
 */
const ATA_LA_COMPRA: Readonly<Record<MotivoDuplicado, 'siempre' | 'si-no-tiene-otro-email' | 'nunca'>> = {
  // Ese email ES la persona que está comprando.
  email: 'siempre',
  // El número y el usuario los escribe cualquiera en un formulario público: sólo si esa ficha no tiene OTRO email.
  telefono: 'si-no-tiene-otro-email',
  instagram: 'si-no-tiene-otro-email',
  // Un homónimo es otra persona. (El caso de UNA sola coincidencia por nombre y sin email se resuelve más abajo.)
  nombre: 'nunca',
};
export function leadDeLaCompra(coincidencias: ReadonlyArray<{ motivo: MotivoDuplicado; lead: { id: number; email?: string | null } }>, email: string): number | null {
  const sinOtroEmail = (x: string | null | undefined) => !x?.trim() || x.trim().toLowerCase() === email.trim().toLowerCase();
  const fuerte = coincidencias.find((c) => {
    const ata = ATA_LA_COMPRA[c.motivo];
    return ata === 'siempre' || (ata === 'si-no-tiene-otro-email' && sinOtroEmail(c.lead.email));
  });
  if (fuerte) return fuerte.lead.id;
  return coincidencias.length === 1 && !coincidencias[0].lead.email?.trim() ? coincidencias[0].lead.id : null;
}
