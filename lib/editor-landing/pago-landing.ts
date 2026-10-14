// =============================================================================
// editor-landing/pago-landing — el «Botón de pago» de una landing, cobrado por la pasarela de MaKo
// =============================================================================
// Pedido (tanda 4, 14/10/2026): conectar el «Botón de pago» de las landings a la PASARELA DE MaKo
// (Stripe / Mercado Pago del negocio, lib/cobros.ts) en vez de que la persona pegue un link. Decisión
// de Martín (14/10/2026): antes del checkout se le piden NOMBRE y EMAIL a quien paga.
//
// El recorrido, de punta a punta:
//   1. EDITOR: el botón guarda `href: 'pago:<productoId>'` (un producto ACTIVO del catálogo). No es un
//      atributo nuevo del nodo `boton` a propósito: el `href` ya existe en el esquema de TipTap, en el
//      saneo (validar.ts) y en `attrsBoton` (especificacion.ts), así que la forma nueva pasa por las
//      MISMAS puertas que un `pagina:<id>` y ninguna se queda vieja (hallazgos: «un JSON que no cumple
//      el esquema abre VACÍO y el autoguardado lo pisa»; un atributo nuevo eran cuatro lugares más).
//   2. PUBLICAR: la foto guarda `pagos: [productoId…]` (los productos que la landing PUBLICADA ofrece,
//      `productosDePago`), y el render escribe el href como `<base del sitio>/pagar/<productoId>` con
//      la MISMA base con que enlaza sus páginas (`urlPasoPago`, la usa render.ts en `resolverHref`).
//   3. PASO DE NOMBRE Y EMAIL: app/l/[slug]/pagar/[bloque]/route.ts (GET, HTML entero, sin sesión).
//   4. POST app/api/landing-generator/pagar: valida, busca o crea el lead, reusa el cobro pendiente
//      del mismo lead Y producto o crea uno (`crearCobro`), y redirige (303) al link /pagar/<token>.
//
// ⚠️ PURO Y LIVIANO: sin server-only, sin node:*, sin React, y sin nada que arrastre el CRM. Lo importan
// el editor (el control del botón y el aviso antes de publicar: viaja al NAVEGADOR), render.ts,
// especificacion.ts y tests/editor-landing-pago.test.ts. Lo del pedido (el formulario, el Origin, el
// lead por email, el cobro a reusar) vive en pago-pedido.ts, que importa del CRM y sólo usa el server;
// lo que habla con la base, en pago-landing-server.ts; el HTML del paso, en pago-pagina.ts.
// =============================================================================

import { NODO } from './doc';
import { NOMBRE_PASARELA, type Pasarela, type TipoCobro } from '../cobros-tipos';
import { formatoMonto } from '../pasarela-moneda';

// ─────────────────────────────────────────────────────────────────────────────
// El destino guardado: `pago:<productoId>`
// ─────────────────────────────────────────────────────────────────────────────

export const PREFIJO_HREF_PAGO = 'pago:';
/** `pago:` + el id del producto (entero positivo, sin ceros adelante, hasta 10 dígitos). */
const RE_HREF_PAGO = /^pago:([1-9][0-9]{0,9})$/;
/** El id de producto como viaja en un segmento de URL (el `[bloque]` del paso). */
const RE_ID_PRODUCTO = /^[1-9][0-9]{0,9}$/;

/** El href que guarda un botón cobrado por MaKo. */
export function hrefDePago(productoId: number): string {
  return `${PREFIJO_HREF_PAGO}${productoId}`;
}

/** El producto de un href `pago:<id>`, o null si no es un destino de pago bien formado. */
export function productoDeHref(h: unknown): number | null {
  if (typeof h !== 'string') return null;
  const m = RE_HREF_PAGO.exec(h.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export const esHrefPago = (h: unknown): h is string => productoDeHref(h) !== null;

/** El href de pago en su forma canónica (sin espacios), o null. Lo usan `attrsBoton` y la IA. */
export function hrefPagoValido(h: unknown): string | null {
  const id = productoDeHref(h);
  return id === null ? null : hrefDePago(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// La URL del paso de nombre y email
// ─────────────────────────────────────────────────────────────────────────────

/** El segmento fijo del paso: `/l/<slug>/pagar/<productoId>` (en hola-mako.site, `/<slug>/pagar/<id>`). */
export const SEGMENTO_PAGO = 'pagar';

/**
 * `<base>/pagar/<productoId>`, con la MISMA base con que el render enlaza las páginas del sitio
 * (`urlBase`: `https://hola-mako.com/l/<slug>` al publicar; la mudanza a hola-mako.site la cambia en UN
 * lugar y esto la sigue sola). La base '/' (la raíz de un sitio) no duplica la barra.
 */
export function urlPasoPago(base: string, productoId: number): string {
  const b = base.replace(/\/+$/, '');
  return `${b}/${SEGMENTO_PAGO}/${productoId}`;
}

/** El id de producto del segmento `[bloque]`, o null si no tiene la forma. */
export function productoDeSegmento(seg: unknown): number | null {
  if (typeof seg !== 'string' || !RE_ID_PRODUCTO.test(seg)) return null;
  const n = Number(seg);
  return Number.isSafeInteger(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué productos ofrece una landing (la foto publicada los congela)
// ─────────────────────────────────────────────────────────────────────────────

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Un sitio no tiene por qué cobrar más que esto: un JSON hostil no infla la foto. */
const TOPE_PRODUCTOS = 50;

function cadaBotonDePago(nodos: unknown, fn: (productoId: number) => void, prof = 0): void {
  if (!Array.isArray(nodos) || prof > 40) return;
  for (const n of nodos) {
    if (!esObj(n)) continue;
    // Una sección OCULTA no se publica (paginasParaPublicar ya la saca; acá también, por si alguien
    // llama con el contenido entero).
    if (n.type === NODO.tarjeta && esObj(n.attrs) && n.attrs.oculta === true) continue;
    if (n.type === NODO.boton) {
      const id = esObj(n.attrs) ? productoDeHref(n.attrs.href) : null;
      if (id !== null) fn(id);
      continue;
    }
    cadaBotonDePago(n.content, fn, prof + 1);
  }
}

/**
 * Los productos que cobran los botones de estas páginas (ordenados, sin repetir). Es lo que la foto
 * publicada guarda en `publicado.pagos`: el POST sólo crea un cobro de un producto que la landing
 * PUBLICADA ofrece, nunca de uno que mande el pedido (un visitante no elige qué producto del catálogo
 * se le cobra, ni a qué precio).
 */
export function productosDePago(paginas: ReadonlyArray<{ doc?: { content?: unknown } } | null | undefined>): number[] {
  const set = new Set<number>();
  for (const p of paginas ?? []) cadaBotonDePago(p?.doc?.content, (id) => set.add(id));
  return [...set].sort((a, b) => a - b).slice(0, TOPE_PRODUCTOS);
}

/** Los productos de una foto publicada (`landing_docs.publicado.pagos`). Una foto anterior a la tanda 4: []. */
export function productosDeFoto(publicado: unknown): number[] {
  if (!esObj(publicado) || !Array.isArray(publicado.pagos)) return [];
  const out: number[] = [];
  for (const v of publicado.pagos) {
    if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && !out.includes(v)) out.push(v);
  }
  return out.slice(0, TOPE_PRODUCTOS);
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Se puede cobrar? (el editor lo avisa ANTES de publicar; el server lo vuelve a preguntar)
// ─────────────────────────────────────────────────────────────────────────────

/** Un producto del catálogo, con lo que hace falta para cobrarlo desde una landing. */
export type ProductoDePago = { id: number; nombre: string; tipo: TipoCobro; montoUsd: number | null };

/** Lo que el editor necesita saber de la pasarela del negocio (la respuesta de la acción `cobro`). */
export type EstadoCobroLanding = { conectadas: Pasarela[]; productos: ProductoDePago[] };

export type MotivoNoCobra = 'sin-pasarela' | 'solo-mercadopago' | 'sin-producto' | 'sin-precio';

/**
 * Con qué pasarela cobra una landing: STRIPE, y sólo Stripe.
 *
 * ⚠️ MERCADO PAGO NO, Y NO ES UN OLVIDO: Mercado Pago cobra en la moneda del sitio de SU cuenta (ARS,
 * MXN, BRL…) y el catálogo guarda el precio en dólares (`productos.monto_usd`). `decidirCobro`
 * (lib/cobros-reglas.ts) le exige el monto explícito en esa moneda, y el monto NUNCA sale del pedido
 * del visitante: un dólar no se convierte solo (nunca una tasa inventada, AGENTS.md). Es la misma
 * decisión que tomó la API de MaKo para `crear_link_pago` (lib/api-mako/areas/cobros.run.ts).
 */
export function pasarelaDeLanding(conectadas: readonly Pasarela[]): Pasarela | null {
  return conectadas.includes('stripe') ? 'stripe' : null;
}

/** Por qué ESE producto no se puede cobrar desde la landing, o null si se puede. */
export function motivoNoCobra(p: { conectadas: readonly Pasarela[]; producto: ProductoDePago | null | undefined }): MotivoNoCobra | null {
  if (!p.producto) return 'sin-producto';
  const m = Number(p.producto.montoUsd);
  if (!(Number.isFinite(m) && m > 0)) return 'sin-precio';
  if (pasarelaDeLanding(p.conectadas)) return null;
  return p.conectadas.includes('mercadopago') ? 'solo-mercadopago' : 'sin-pasarela';
}

/**
 * El motivo, para el DUEÑO (el control del botón, el aviso de Publicar y el historial del lead). Una
 * frase: qué falta y dónde se arregla. Al visitante nunca: él ve `TEXTO_NO_DISPONIBLE`.
 */
export const TEXTO_NO_COBRA: Readonly<Record<MotivoNoCobra, string>> = {
  'sin-pasarela': 'Conecta Stripe en Integraciones para cobrar.',
  'solo-mercadopago': 'Mercado Pago cobra en tu moneda y tus precios están en dólares: conecta Stripe.',
  'sin-producto': 'Ese producto ya no está activo en el catálogo.',
  'sin-precio': 'Ese producto no tiene precio en el catálogo.',
};

/** ¿El motivo se arregla en Integraciones? (el control lleva el link ahí). */
export const seArreglaEnIntegraciones = (m: MotivoNoCobra | null): boolean => m === 'sin-pasarela' || m === 'solo-mercadopago';

/** `US$ 99` o `US$ 49 por mes`. null sin precio. */
export function precioDe(p: Pick<ProductoDePago, 'tipo' | 'montoUsd'>): string | null {
  const m = Number(p.montoUsd);
  if (!(Number.isFinite(m) && m > 0)) return null;
  return `${formatoMonto(m, 'USD')}${p.tipo === 'suscripcion' ? ' por mes' : ''}`;
}

/** La nota del paso: con qué se paga. */
export const notaDePasarela = (p: Pasarela): string => `Pago seguro con ${NOMBRE_PASARELA[p]}.`;

// ─────────────────────────────────────────────────────────────────────────────
// Lo que dice el editor (el control del botón y el aviso de Publicar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El rótulo del botón «Destino» cuando el botón cobra: `Cobra: <producto>`, y el motivo si hoy no
 * puede. Sin el estado todavía (se está leyendo), sólo `Cobro`. null si el href no es de pago.
 */
export function describirCobro(href: unknown, estado: EstadoCobroLanding | null): { texto: string; motivo: MotivoNoCobra | null } | null {
  const id = productoDeHref(href);
  if (id === null) return null;
  if (!estado) return { texto: 'Cobro', motivo: null };
  const producto = estado.productos.find((p) => p.id === id) ?? null;
  return { texto: producto ? `Cobra: ${producto.nombre}` : 'Cobra: producto inactivo', motivo: motivoNoCobra({ conectadas: estado.conectadas, producto }) };
}

/**
 * El aviso de Publicar: ANTES de publicar, si algún botón de pago no va a poder cobrar. Una frase (la
 * del primer motivo); `integraciones` dice si el arreglo es conectar Stripe (lleva el link). null si
 * no hay botones de pago o si todos cobran.
 */
export function avisoDeCobro(paginas: ReadonlyArray<{ doc?: { content?: unknown } } | null | undefined>, estado: EstadoCobroLanding): { texto: string; integraciones: boolean } | null {
  const motivos = productosDePago(paginas)
    .map((id) => motivoNoCobra({ conectadas: estado.conectadas, producto: estado.productos.find((p) => p.id === id) ?? null }))
    .filter((m): m is MotivoNoCobra => m !== null);
  if (!motivos.length) return null;
  const quien = motivos.length === 1 ? 'Un botón de pago no cobra' : `${motivos.length} botones de pago no cobran`;
  return { texto: `${quien}: ${TEXTO_NO_COBRA[motivos[0]]}`, integraciones: seArreglaEnIntegraciones(motivos[0]) };
}
