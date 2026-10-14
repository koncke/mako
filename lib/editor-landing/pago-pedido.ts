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
import { motivoNoCobra, pasarelaDeLanding, productoDeSegmento, type EstadoCobroLanding, type MotivoNoCobra } from './pago-landing';
import type { Cobro, Pasarela, TipoCobro } from '../cobros-tipos';
import { emailNormalizado, emailUtilizable } from '../agencia-altas';
import { emailComparable } from '../leads-duplicados';

/** Adonde postea el formulario del paso. RELATIVA a propósito: el mismo host que sirve la página. */
export const RUTA_POST_PAGO = '/api/landing-generator/pagar';

// ─────────────────────────────────────────────────────────────────────────────
// Lo que manda el formulario del paso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El campo trampa: invisible para una persona (fuera de la pantalla, sin tab, sin autocompletar) y
 * tentador para un bot. Con algo adentro, no se crea nada. El nombre no dice «trampa» a propósito.
 */
export const CAMPO_TRAMPA = 'sitio_web';
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

/**
 * El host donde se van a servir las landings publicadas (la mudanza en curso: `https://hola-mako.site/<slug>`).
 * ⚠️ SI LA MUDANZA LO DECLARA EN OTRO LADO (p. ej. en `DOMINIOS_DE_MAKO`), esto pasa a importarlo de ahí:
 * dos constantes del mismo host son la misma regla escrita dos veces.
 */
export const HOST_SITIOS = 'hola-mako.site';

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
 * de los sitios publicados, o el MISMO host que contesta cuando es un deploy de MaKo o una máquina local
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
  if (esDe(host, HOST_SITIOS) || DOMINIOS_DE_MAKO.some((d) => esDe(host, d))) return { tipo: 'mako' };
  // Un `*.vercel.app` que no es el que contesta cae acá y vuelve null: `dominioValido` ya excluye todo host
  // de MaKo (`motivoDominioInvalido`). Un renglón propio para eso era código muerto (lo dijo la rotura).
  return dominioValido(host) ? { tipo: 'dominio', host } : null;
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
      await dep.soltar(t.id, resultadoDe(valor)).catch((e) => dep.log('error', `no pude soltar el candado ${t.id}: ${e instanceof Error ? e.message : String(e)}`));
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
