// =============================================================================
// editor-landing/pago-pedido — lo que manda el visitante en el paso de pago, y qué se hace con eso
// =============================================================================
// Tanda 4 (14/10/2026): el «Botón de pago» de una landing cobrado por la pasarela de MaKo
// (pago-landing.ts tiene el recorrido entero). Acá vive lo que DECIDE el POST de
// app/api/landing-generator/pagar sin tocar la base: leer el formulario (con el campo trampa), de
// dónde viene (Origin, en positivo), cuál es el lead de ese email (comparación EXACTA), si un cobro
// pendiente ya es lo que se va a cobrar, y el ORDEN del cobro (`ejecutarPago`: el techo de la hora, el
// candado por email y la propuesta cuando no se puede cobrar), con lo que toca la base inyectado.
//
// ⚠️ PURO (sin server-only, con test) PERO NO PARA EL NAVEGADOR: importa del CRM (`emailComparable`
// arrastra el embudo entero). El editor importa pago-landing.ts, nunca éste.
// =============================================================================

import { slugValido } from './doc';
import { DOMINIOS_DE_MAKO, dominioValido, esHostDeMako } from './dominios-reglas';
import { RUTA_PAGAR_LANDING, esHostDeLandings } from './origen-landings';
import { motivoNoCobra, pasarelaDeLanding, productoDeSegmento, type EstadoCobroLanding, type MotivoNoCobra } from './pago-landing';
import type { Cobro, Pasarela, TipoCobro } from '../cobros-tipos';
import { emailNormalizado, emailUtilizable } from '../agencia-altas';
import { emailComparable } from '../leads-duplicados';

/**
 * Adonde postea el formulario del paso. RELATIVA a propósito: el mismo host que sirve la página
 * (en hola-mako.site el proxy deja pasar SÓLO este POST: `RUTA_PAGAR_LANDING`, origen-landings.ts).
 */
export const RUTA_POST_PAGO = RUTA_PAGAR_LANDING;

// ─────────────────────────────────────────────────────────────────────────────
// Lo que manda el formulario del paso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El campo trampa: invisible para una persona (fuera de la pantalla, sin tab, sin autocompletar) y
 * tentador para un bot. Con algo adentro, no se crea nada. El nombre no dice «trampa» a propósito.
 * ⚠️ Y no dice NADA que un completador de formularios reconozca (revisión de la tanda 4, BAJA): se
 * llamaba `sitio_web`, que es justo lo que un gestor de autocompletado llena con la web de la persona,
 * y un comprador real recibía «No pudimos abrir el pago» sin que quedara rastro. Un nombre sin sentido.
 */
export const CAMPO_TRAMPA = 'mk_q7';
export const TOPE_NOMBRE = 120;
export const TOPE_EMAIL = 254;

export type PedidoPago = { slug: string; productoId: number; nombre: string; email: string };
export type FallaPedidoPago = 'forma' | 'trampa' | 'nombre' | 'email';
/**
 * Lo que falló y, si fue un CAMPO, lo que se mandó: el POST vuelve a dibujar el formulario con el
 * error y con lo que la persona ya había escrito (nadie vuelve a tipear su nombre por un email mal).
 */
export type LecturaPedidoPago =
  | { ok: true; pedido: PedidoPago }
  | { ok: false; falla: 'forma' | 'trampa' }
  | { ok: false; falla: 'nombre' | 'email'; slug: string; productoId: number; valores: { nombre: string; email: string } };

/** Un nombre limpio: sin caracteres de control, espacios colapsados, recortado. '' si no queda nada. */
export function nombreLimpio(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_NOMBRE);
}

/**
 * Lee el cuerpo del formulario. El ORDEN importa: lo que no tiene forma (slug, producto) no llega ni a
 * mirar la trampa; la trampa va antes que los campos (un bot no recibe pistas de qué le faltó).
 */
export function leerPedidoPago(campos: { get(k: string): string | null }): LecturaPedidoPago {
  const slug = (campos.get('slug') ?? '').trim();
  const productoId = productoDeSegmento((campos.get('bloque') ?? '').trim());
  if (!slugValido(slug) || productoId === null) return { ok: false, falla: 'forma' };
  if ((campos.get(CAMPO_TRAMPA) ?? '').trim() !== '') return { ok: false, falla: 'trampa' };
  const nombre = nombreLimpio(campos.get('nombre'));
  const email = emailNormalizado(campos.get('email') ?? '').slice(0, TOPE_EMAIL + 1);
  const valores = { nombre, email: email.slice(0, TOPE_EMAIL) };
  if (!nombre) return { ok: false, falla: 'nombre', slug, productoId, valores };
  if (!emailUtilizable(email) || email.length > TOPE_EMAIL) return { ok: false, falla: 'email', slug, productoId, valores };
  return { ok: true, pedido: { slug, productoId, nombre, email } };
}

/** El texto corto que ve el visitante en el formulario cuando un campo no sirve. */
export const TEXTO_FALLA_CAMPO: Readonly<Record<'nombre' | 'email', string>> = {
  nombre: 'Escribe tu nombre.',
  email: 'Revisa tu email.',
};

/** Lo que ve el visitante cuando no se puede cobrar (el motivo real va al historial del lead). */
export const TEXTO_NO_DISPONIBLE = 'Este pago no está disponible en este momento.';
/** Lo que ve cuando falló algo nuestro o de la pasarela (el motivo real, al log y al historial). */
export const TEXTO_FALLO = 'No pudimos abrir el pago. Prueba de nuevo en unos minutos.';
export const TEXTO_DEMASIADOS = 'Demasiados intentos. Prueba de nuevo en unos minutos.';

// ─────────────────────────────────────────────────────────────────────────────
// De dónde viene el POST (Origin)
// ─────────────────────────────────────────────────────────────────────────────

export type OrigenPago = { tipo: 'mako' } | { tipo: 'dominio'; host: string };

const origenDe = (url: string | null | undefined): string | null => {
  try {
    const u = new URL(String(url ?? ''));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
};

const esDe = (host: string, base: string): boolean => host === base || host.endsWith('.' + base);

/**
 * ¿Desde dónde se mandó el formulario? EN POSITIVO: la app (APP_BASE_URL), un dominio de MaKo, el host
 * de las landings publicadas (hola-mako.site, `esHostDeLandings`: la MISMA declaración que usa el
 * proxy), o el MISMO host que contesta cuando es un deploy de MaKo o una máquina local
 * (en dev la landing se sirve en /l/<slug> del mismo host). Un dominio de cliente vuelve como
 * `dominio`: quien llama confirma que es el de ESA landing (`landingDeDominio`). Lo demás —sin Origin,
 * `null` (un iframe sandbox), otro sitio, un puerto raro— es null.
 *
 * ⚠️ `*.vercel.app` NO entra solo: es de cualquier cliente de Vercel. Sólo el deploy que contesta.
 * ⚠️ No es una barrera contra un script (el Origin se falsifica con curl): corta el formulario de un
 *    sitio ajeno en el navegador de un visitante. Lo que frena el abuso son los topes y la trampa.
 */
export function origenDelPago(origin: string | null | undefined, op: { appBaseUrl: string; propio?: string | null }): OrigenPago | null {
  if (!origin || origin === 'null') return null;
  const o = origenDe(origin);
  if (!o || o !== origin.trim().replace(/\/+$/, '')) return null;
  if (o === origenDe(op.appBaseUrl)) return { tipo: 'mako' };
  const u = new URL(o);
  const host = u.hostname.toLowerCase();
  const propio = origenDe(op.propio);
  const local = host === 'localhost' || host === '127.0.0.1';
  if (o === propio && (local || esHostDeMako(host))) return { tipo: 'mako' };
  if (u.protocol !== 'https:' || u.port) return null;
  if (esHostDeLandings(host) || DOMINIOS_DE_MAKO.some((d) => esDe(host, d))) return { tipo: 'mako' };
  // Un `*.vercel.app` que no es el que contesta cae acá y vuelve null: `dominioValido` ya excluye todo host
  // de MaKo (`motivoDominioInvalido`). Un renglón propio para eso era código muerto (lo dijo la rotura).
  return dominioValido(host) ? { tipo: 'dominio', host } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// De qué anuncio vino quien paga (Paquete 3 de la tanda 6)
// ─────────────────────────────────────────────────────────────────────────────
// Revisión de la tanda 4: «La atribución del anuncio se pierde en el lead que nace por el botón de
// pago». El opt-in le pasa a `createLead` los utm y el fbclid (app/api/track/optin); el lead que nace
// pagando —la conversión más cara— nacía sin nada: el href del botón es fijo y el paso no tiene el Pixel.
// Lo que SÍ llega es el Referer: la política de la casa (next.config.ts, strict-origin-when-cross-origin)
// manda la URL ENTERA, con su query, entre páginas del MISMO origen. El GET del paso la lee si es de su
// mismo host y la escribe como inputs hidden; el POST la vuelve a sanear (lo del formulario lo escribe
// cualquiera) y se la pasa a `createLead` y a la propuesta.
//
// ⚠️ SIN `utm_term`, A PROPÓSITO. `leads` no tiene esa columna, y en esta casa `utm_term` es el canal por
//    donde Calendly devuelve el `visitor_id` (lib/leads.ts, mig 0008). Pasar el término de un anuncio a
//    `visitor_id` ataría la ficha a una visita que no existe. El `visitor_id` lo pone el Pixel (otra área).
// ⚠️ SÓLO la página de aterrizaje: si la persona llegó a /precios por un enlace sin la query, el Referer
//    ya no la trae. Recordarla entre páginas es del Pixel (lib/landing-token.ts).

export const CAMPOS_ATRIBUCION_PAGO = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const;
export type CampoAtribucionPago = (typeof CAMPOS_ATRIBUCION_PAGO)[number];
export type AtribucionPago = Record<CampoAtribucionPago, string | null>;
export const ATRIBUCION_PAGO_VACIA: Readonly<AtribucionPago> = Object.freeze({ utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, fbclid: null });

/**
 * Los techos de un valor. Un utm se RECORTA (es un nombre que se lee: «Campaña otoño…» sirve igual) a 200
 * caracteres, los del opt-in (lib/atribucion-url.ts), y a 300 ya codificado en el formulario. Un fbclid
 * NO se recorta: la mig 0177 lo guarda «tal cual, sin parsear» porque la API de Conversiones de Meta lo
 * pide entero, y uno cortado no identifica ningún clic: más largo que 300, no va (la propuesta corta a
 * 300, app/crm/revisar/[id]/propuesta-lead.ts). Con estos techos, el formulario más pesado posible entra
 * en `TOPE_CUERPO_PAGO` (pago-pagina.ts): lo mide el test.
 */
export const TOPE_ATRIBUCION_UTM = 200;
export const TOPE_ATRIBUCION_CODIFICADA = 300;

/** Cuánto pesa un valor en un formulario `application/x-www-form-urlencoded` (el serializador del navegador). */
export const largoEnFormulario = (v: string): number => new URLSearchParams([['', v]]).toString().length - 1;

// Los de control (C0, DEL, C1), los de ancho cero y los que dan vuelta el texto (bidi): no son de un nombre de campaña.
// eslint-disable-next-line no-control-regex
const RARO = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]+/g;

/** Un valor de atribución que se puede guardar, o null. Nunca tira. */
export function valorDeAtribucion(campo: CampoAtribucionPago, v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.replace(RARO, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) return null;
  if (campo === 'fbclid') return /\s/.test(limpio) || largoEnFormulario(limpio) > TOPE_ATRIBUCION_CODIFICADA ? null : limpio;
  let out = '';
  let n = 0;
  for (const c of limpio) {
    if (n >= TOPE_ATRIBUCION_UTM || largoEnFormulario(out + c) > TOPE_ATRIBUCION_CODIFICADA) break;
    out += c;
    n++;
  }
  return out.trim() || null;
}

/** La atribución de unos campos (la query del Referer o el cuerpo del POST), saneada campo por campo. */
export function atribucionDeCampos(campos: { get(k: string): string | null }): AtribucionPago {
  const out = { ...ATRIBUCION_PAGO_VACIA };
  for (const k of CAMPOS_ATRIBUCION_PAGO) out[k] = valorDeAtribucion(k, campos.get(k));
  return out;
}

export const hayAtribucionPago = (a: AtribucionPago): boolean => CAMPOS_ATRIBUCION_PAGO.some((k) => !!a[k]);

/**
 * La atribución del Referer, SÓLO si es una página del MISMO host que sirve el paso (`hosts`: el de la URL
 * y el de la cabecera Host, en minúsculas). Un sitio ajeno con `Referrer-Policy: unsafe-url` no le escribe
 * la campaña a la ficha de otro negocio. Lo que no se puede leer, vacío.
 */
export function atribucionDelReferer(referer: string | null | undefined, hosts: readonly (string | null | undefined)[]): AtribucionPago {
  if (!referer) return { ...ATRIBUCION_PAGO_VACIA };
  let u: URL;
  try { u = new URL(referer); } catch { return { ...ATRIBUCION_PAGO_VACIA }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ...ATRIBUCION_PAGO_VACIA };
  const propios = new Set(hosts.filter((h): h is string => typeof h === 'string' && h.trim() !== '').map((h) => h.trim().toLowerCase()));
  if (!propios.has(u.host.toLowerCase())) return { ...ATRIBUCION_PAGO_VACIA };
  return atribucionDeCampos(u.searchParams);
}

// ─────────────────────────────────────────────────────────────────────────────
// El lead y el cobro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El lead de ese email en el negocio: comparación EXACTA (`emailComparable`), nunca un patrón (un `_`
 * del email es comodín en `ilike`, AGENTS.md «Un patrón trae CANDIDATOS»). Con más de uno se elige el
 * MÁS VIEJO (el id más chico): es la ficha que actualizan Calendly y Meta, y elegirla es un dato, no
 * el primero que devolvió la consulta. `ambiguo` lo dice para dejarlo escrito.
 */
export function leadPorEmail(candidatos: ReadonlyArray<{ id: number | string; email?: string | null }>, email: string): { id: number; ambiguo: boolean } | null {
  const buscado = emailComparable(email);
  if (!buscado) return null;
  const ids = candidatos
    .filter((c) => emailComparable(c.email) === buscado)
    .map((c) => Number(c.id))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .sort((a, b) => a - b);
  return ids.length ? { id: ids[0], ambiguo: ids.length > 1 } : null;
}

/** Lo que se va a cobrar, y para quién: el email que escribió el visitante y la landing de donde vino. */
export type CobroBuscado = { productoId: number; pasarela: Pasarela; monto: number; moneda: string; tipo: TipoCobro; email: string; slug: string };
type CobroComparable = Pick<Cobro, 'estado' | 'producto_id' | 'proveedor' | 'monto' | 'moneda' | 'tipo' | 'email' | 'alta_capa' | 'creado_por'>;

/**
 * ¿Este cobro pendiente ya es lo que se va a cobrar? El MISMO producto, por la MISMA pasarela, al MISMO
 * precio. `cobroPendienteDelLead` devuelve el más nuevo de CUALQUIER producto, y un pendiente viejo con
 * el precio de antes cobraría lo que el catálogo ya no dice: los dos se comparan antes de reusar.
 *
 * ⚠️ Y SÓLO LO QUE CREÓ ESTA LANDING, PARA ESTE EMAIL (revisión de la tanda 4, BAJA). El lead se elige
 * por un email que el visitante ESCRIBE y nadie verifica: sin esto, quien conoce el email de un lead
 * recibía el 303 al token de un pendiente que le armó el DUEÑO desde la ficha o por la API
 * (`crear_link_pago` pasa `productoId`), con el email de la ficha cargado en el checkout. Y un pendiente
 * con alta de MaKo (`alta_capa`) habilita el cambio de email de app/pagar/cambio-email.ts: entregarlo
 * sería entregar la cuenta. Lo que no creó una landing no se reusa NUNCA desde una landing.
 */
export function cobroReusable(c: CobroComparable, b: CobroBuscado): boolean {
  const email = emailComparable(c.email);
  return c.estado === 'pendiente'
    && c.alta_capa == null
    && esDeLaLanding(c.creado_por, b.slug)
    && email !== null && email === emailComparable(b.email)
    && c.producto_id === b.productoId
    && c.proveedor === b.pasarela
    && String(c.moneda).toUpperCase() === b.moneda.toUpperCase()
    && Math.round(Number(c.monto) * 100) === Math.round(b.monto * 100)
    && c.tipo === b.tipo;
}

/** El primer pendiente reusable (la lista viene del más nuevo al más viejo), o null. */
export function cobroPendienteReusable<C extends CobroComparable>(pendientes: readonly C[], b: CobroBuscado): C | null {
  return pendientes.find((c) => cobroReusable(c, b)) ?? null;
}

/** El `creadoPor` del cobro y el autor del historial: de QUÉ landing vino. */
export function creadoPorLanding(titulo: string, slug: string): string {
  const t = nombreLimpio(titulo).slice(0, 60) || slug;
  return `Landing «${t}» (${slug})`;
}

/**
 * ¿Este `creado_por` lo escribió `creadoPorLanding` para ESA landing? Por el slug y no por el texto
 * entero: si el dueño le cambia el título a la landing, el pendiente de ayer sigue siendo de ella.
 */
export function esDeLaLanding(creadoPor: string | null | undefined, slug: string): boolean {
  return typeof creadoPor === 'string' && creadoPor.startsWith('Landing «') && creadoPor.endsWith(`» (${slug})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagar: el techo, el candado y el orden (las lecturas y escrituras entran por `dep`)
// ─────────────────────────────────────────────────────────────────────────────
// Revisión de la tanda 4 (MEDIA, dos hallazgos). Lo que vivía en `pagarDesdeLanding` sin poder probarse:
//
//   · NO ERA IDEMPOTENTE ANTE DOS PEDIDOS A LA VEZ. «Buscar el lead por email y, si no está, crearlo» y
//     «reusar el pendiente o crear uno» son lecturas seguidas de escrituras, y ni `leads` tiene un único
//     por email ni `cobros` uno por (lead, producto, pendiente). Un doble clic en «Ir a pagar» —el paso no
//     tiene JavaScript que apague el botón— dejaba DOS fichas de la misma persona en el CRM del cliente y
//     dos Checkout Sessions en su Stripe. Ahora todo corre adentro de un CANDADO por (negocio, email)
//     (`conCandado`, tabla `landing_pago_pedidos`, mig 0276): el segundo pedido espera a que termine el
//     primero, y entonces encuentra la ficha y el pendiente que dejó — y redirige al MISMO checkout.
//   · CREABA FICHAS AUNQUE NO SE PUDIERA COBRAR. Un POST público, sin sesión y con topes que viven en la
//     memoria de cada instancia, escribía directo en el CRM de cualquier negocio con una landing publicada,
//     también sin Stripe, sin precio o con el producto inactivo. Sin cobro no hace falta una ficha: queda
//     una PROPUESTA (`dep.proponer`, lib/propuestas.ts, la regla de la casa: un canal propone y una persona
//     confirma), y el visitante igual lee «Ya tenemos tus datos». Y hay un TECHO por landing y hora que
//     cuenta en la BASE (`TECHO_PAGOS_HORA`): no depende de qué instancia atiende.

/** Lo que contesta el cobro de un producto de la landing (lo traduce `responderPagoPost`). */
export type ResultadoPago =
  | { tipo: 'redirigir'; url: string; reusado: boolean }
  /** No se puede cobrar ese producto hoy: quedó una PROPUESTA de contacto con el motivo, para el dueño. */
  | { tipo: 'no-disponible'; motivo: MotivoNoCobra }
  /** La landing pasó el techo de la hora: no se escribió nada. */
  | { tipo: 'demasiados' }
  /** Falló la pasarela o la base, o el candado no se soltó a tiempo: el motivo, al log (y al historial si hay lead). */
  | { tipo: 'fallo' };

/**
 * Cuántos pedidos de pago acepta UNA landing por hora, contados en la base. Es un techo contra el abuso
 * (cada pedido puede crear una ficha y un checkout en el Stripe del cliente), no un número de negocio:
 * dos por minuto sostenidos durante una hora es mucho más de lo que vende una landing de estos clientes.
 */
export const TECHO_PAGOS_HORA = 120;
/** Un candado más viejo que esto quedó colgado (la ruta corta a los 60 s): otro pedido lo puede soltar. */
export const CANDADO_VENCE_MS = 90_000;
/**
 * Cuánto viven las filas de `landing_pago_pedidos` (Paquete 3 de la tanda 6: «Nadie poda
 * `landing_pago_pedidos`»). El techo cuenta sólo la última hora y el candado vence a los 90 s: una semana
 * no le cambia nada a ninguno de los dos y deja una semana para mirar qué pasó con un pedido.
 */
export const PODA_PEDIDOS_MS = 7 * 24 * 3_600_000;
/** Desde cuándo se borra (`created_at` MENOR que esto). */
export const corteDePoda = (ahora: number): string => new Date(ahora - PODA_PEDIDOS_MS).toISOString();
/** Cuánto espera un pedido a que el otro termine (crear un checkout tarda unos segundos). */
export const CANDADO_ESPERA_MS = 20_000;
export const CANDADO_PASO_MS = 400;

/** Lo que contesta el intento de tomar el candado. `sin-tabla` = la mig 0276 no está aplicada. */
export type Toma = { tipo: 'tomado'; id: number } | { tipo: 'ocupado'; id: number; desde: number } | { tipo: 'sin-tabla' };

export type DepCandado = {
  /** Tira = la base falló (no es «ocupado»). */
  tomar: () => Promise<Toma>;
  /** Suelta el candado propio, con lo que pasó (para mirar después). */
  soltar: (id: number, resultado: string) => Promise<void>;
  /** Suelta uno colgado (más viejo que `CANDADO_VENCE_MS`), sólo si sigue tomado. */
  vencer: (id: number) => Promise<void>;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
  log: (nivel: 'warn' | 'error', texto: string) => void;
  /**
   * Borra las filas de ESTA landing más viejas que `PODA_PEDIDOS_MS` (Paquete 3 de la tanda 6: la mig 0276
   * decía «nadie las poda todavía»). Corre al soltar el candado propio, A LA PAR de soltarlo: no le suma
   * espera a quien paga. Opcional: sin ella (los tests de antes) no se poda nada.
   */
  podar?: () => Promise<void>;
};

/**
 * Corre `trabajo` con el candado tomado, o espera a que se suelte. `sin-tabla` corre igual, SIN candado
 * (lo de antes de la mig 0276) y lo dice en el log: un pago no se frena por una migración que falta.
 * Lo que tira el trabajo suelta el candado y vuelve a tirar.
 */
export async function conCandado<T>(dep: DepCandado, trabajo: () => Promise<T>, resultadoDe: (t: T) => string): Promise<{ tipo: 'hecho'; valor: T } | { tipo: 'ocupado' }> {
  const hasta = dep.ahora() + CANDADO_ESPERA_MS;
  for (;;) {
    const t = await dep.tomar();
    if (t.tipo === 'sin-tabla') {
      dep.log('warn', 'sin la tabla landing_pago_pedidos (mig 0276): corre sin candado ni techo');
      return { tipo: 'hecho', valor: await trabajo() };
    }
    if (t.tipo === 'tomado') {
      let valor: T;
      try {
        valor = await trabajo();
      } catch (e) {
        await dep.soltar(t.id, 'excepcion').catch(() => {});
        throw e;
      }
      // La poda va a la par de soltar (no toca la fila recién soltada: es de hace segundos) y su falla no
      // es del pago: al log, y el que viene la vuelve a intentar.
      await Promise.all([
        dep.soltar(t.id, resultadoDe(valor)).catch((e) => dep.log('error', `no pude soltar el candado ${t.id}: ${e instanceof Error ? e.message : String(e)}`)),
        dep.podar ? dep.podar().catch((e) => dep.log('warn', `no pude podar los pedidos viejos: ${e instanceof Error ? e.message : String(e)}`)) : null,
      ]);
      return { tipo: 'hecho', valor };
    }
    if (dep.ahora() >= hasta) return { tipo: 'ocupado' };
    if (dep.ahora() - t.desde >= CANDADO_VENCE_MS) {
      dep.log('warn', `el candado ${t.id} quedó colgado: se suelta`);
      await dep.vencer(t.id);
    } else {
      await dep.esperar(CANDADO_PASO_MS);
    }
  }
}

/** Un pendiente como lo lista `listarCobros`, con lo que hace falta para decidir y redirigir. */
export type CobroPendiente = CobroComparable & { token: string };

export type DepPago = {
  /** Los pedidos de esta landing en la última hora. null = sin la tabla (mig 0276): no hay techo. Tira = la base falló. */
  usosDeLaHora: () => Promise<number | null>;
  estado: () => Promise<EstadoCobroLanding>;
  candado: DepCandado;
  /** La propuesta de contacto cuando no se puede cobrar (lib/propuestas.ts, con `ref`: no se duplica). */
  proponer: (motivo: MotivoNoCobra, quePide: string) => Promise<void>;
  /** El lead de ese email (el que ya está, o uno nuevo por el camino del opt-in). */
  lead: () => Promise<number>;
  pendientes: (leadId: number) => Promise<readonly CobroPendiente[]>;
  crear: (leadId: number, pasarela: Pasarela) => Promise<{ ok: true; link: string } | { ok: false; error: string }>;
  linkDe: (token: string) => string;
  /** Una línea en el historial del lead (para el DUEÑO: ahí van los errores de la pasarela). */
  historial: (leadId: number, texto: string) => Promise<void>;
};

/**
 * El cobro de un producto de la landing (ya validado contra la foto PUBLICADA: lo hace la ruta) para el
 * email que escribió el visitante. El orden: el techo de la hora → qué se puede cobrar → el candado →
 * adentro, la propuesta (si no se puede cobrar) o el lead y el cobro. Tira si la base no contesta antes
 * de tener lead (la ruta contesta 503).
 */
export async function ejecutarPago(p: { productoId: number; email: string; slug: string }, dep: DepPago): Promise<ResultadoPago> {
  const usos = await dep.usosDeLaHora();
  if (usos !== null && usos >= TECHO_PAGOS_HORA) {
    dep.candado.log('warn', `la landing pasó el techo de la hora (${usos} pedidos): no se escribe nada`);
    return { tipo: 'demasiados' };
  }
  const estado = await dep.estado();
  const producto = estado.productos.find((x) => x.id === p.productoId) ?? null;
  const motivo = motivoNoCobra({ conectadas: estado.conectadas, producto });
  const quePide = producto ? `«${producto.nombre}»` : `el producto #${p.productoId}`;

  const r = await conCandado(dep.candado, async (): Promise<ResultadoPago> => {
    if (motivo) {
      // Sin cobro no hay ficha: una PROPUESTA, que el dueño confirma en /crm/revisar.
      await dep.proponer(motivo, quePide);
      dep.candado.log('warn', `no cobra: ${motivo} (quedó una propuesta)`);
      return { tipo: 'no-disponible', motivo };
    }
    const pasarela = pasarelaDeLanding(estado.conectadas)!;
    const leadId = await dep.lead();
    const buscado: CobroBuscado = { productoId: p.productoId, pasarela, monto: producto!.montoUsd!, moneda: 'USD', tipo: producto!.tipo, email: p.email, slug: p.slug };
    try {
      // El pendiente del MISMO lead, producto, precio, email y landing: un «atrás» y otra vez, o la misma
      // persona dos días después, siguen en el mismo checkout — y con el candado, también un doble clic.
      const ya = cobroPendienteReusable(await dep.pendientes(leadId), buscado);
      if (ya) return { tipo: 'redirigir', url: dep.linkDe(ya.token), reusado: true };
      // Sin `monto`, `moneda`, `montoUsd` ni `altaCapa`: el precio lo pone el catálogo y una landing no da
      // de alta cuentas de MaKo (pago-landing-server.ts, la cabecera).
      const c = await dep.crear(leadId, pasarela);
      if (c.ok) return { tipo: 'redirigir', url: c.link, reusado: false };
      // El error de `crearCobro` está escrito para el DUEÑO: va a su historial, nunca a la pantalla del visitante.
      await dep.historial(leadId, `No se pudo abrir el pago de ${quePide}: ${c.error}`);
      dep.candado.log('error', `lead=${leadId}: ${c.error}`);
      return { tipo: 'fallo' };
    } catch (e) {
      await dep.historial(leadId, `No se pudo abrir el pago de ${quePide}: falló la conexión. Prueba el link desde la ficha.`).catch(() => {});
      dep.candado.log('error', `lead=${leadId} (excepción): ${e instanceof Error ? e.message : String(e)}`);
      return { tipo: 'fallo' };
    }
  }, (x) => x.tipo);

  if (r.tipo === 'ocupado') {
    dep.candado.log('warn', `otro pedido del mismo email no terminó en ${CANDADO_ESPERA_MS / 1000} s`);
    return { tipo: 'fallo' };
  }
  return r.valor;
}

// ─────────────────────────────────────────────────────────────────────────────
// El rastro de los rechazos (Paquete 3 de la tanda 6)
// ─────────────────────────────────────────────────────────────────────────────
// Revisión de la tanda 4, con la regla de AGENTS.md «Una política puede RECHAZAR; no puede no dejar
// rastro»: los 429, 413 y 403 del POST y la trampa quedaban en un console.warn, o en nada. Un dueño
// cuyo comprador leyó «Demasiados intentos» no tenía dónde mirarlo.
//
// Se CUENTAN (`landing_pago_rechazos`, mig 0282: un contador por landing, día y motivo, sin datos
// personales) SÓLO los que llegan DESPUÉS de leer la landing: ahí se sabe de qué negocio son, y cada uno
// suma en una fila que ya existe (como mucho cuatro por landing y día). Los de ANTES (tope por IP, tamaño,
// Origin, forma, trampa) no saben de qué landing son, y una fila por cada uno le regalaría a un bot una
// escritura por pedido (hallazgos del área, tanda 4): van al log, con su motivo.

/** Lo que se cuenta en la base. Cada uno entra en el `check` de la mig 0282 (de 1 a 40 caracteres). */
export const MOTIVOS_RECHAZO_PAGO = ['tope-email', 'techo', 'dominio-ajeno', 'producto'] as const;
export type MotivoRechazoPago = (typeof MOTIVOS_RECHAZO_PAGO)[number];
/** Lo que sólo va al log: llegó antes de saber de qué landing es. */
export type MotivoRechazoSinLanding = 'tope-ip' | 'tamano' | 'origen' | 'forma' | 'trampa';

/** Una fila de `landing_pago_rechazos` como la devuelve la base (`n` puede venir como texto). */
export type FilaRechazoPago = { dia: string; motivo: string; n: number | string | null };
export type ResumenRechazosPago = {
  total: number;
  porMotivo: Record<MotivoRechazoPago, number>;
  /** Motivos que esta versión no conoce (los escribió una más nueva): suman al total igual. */
  otros: number;
  /** El último día con algún rechazo (AAAA-MM-DD), o null. */
  ultimoDia: string | null;
};

/** El resumen para el dueño: cuántos, por qué y hasta cuándo. Lo que no es un número no suma. */
export function resumirRechazos(filas: readonly FilaRechazoPago[]): ResumenRechazosPago {
  const porMotivo = Object.fromEntries(MOTIVOS_RECHAZO_PAGO.map((m) => [m, 0])) as Record<MotivoRechazoPago, number>;
  let total = 0;
  let otros = 0;
  let ultimoDia: string | null = null;
  for (const f of filas) {
    const n = Number(f.n);
    if (!Number.isSafeInteger(n) || n <= 0) continue;
    total += n;
    if ((MOTIVOS_RECHAZO_PAGO as readonly string[]).includes(f.motivo)) porMotivo[f.motivo as MotivoRechazoPago] += n;
    else otros += n;
    if (/^\d{4}-\d{2}-\d{2}$/.test(f.dia) && (ultimoDia === null || f.dia > ultimoDia)) ultimoDia = f.dia;
  }
  return { total, porMotivo, otros, ultimoDia };
}
