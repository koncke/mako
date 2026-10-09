// =============================================================================
// curso-invitar-reglas — las reglas PURAS de invitar a un alumno a UN curso
// =============================================================================
// El feedback del audio del 08/10/2026 a la noche (docs/feedback-curso-08oct-noche.md):
//   6. «el mail nombra DOS productos»: tiene que invitar al producto donde está parado.
//   7. «tengo acceso a los dos cursos, cuando sólo le había invitado al curso de Fiesta Music».
//   9. el formulario de invitar pierde lo escrito al salir de la pestaña.
//  10. si falta el correo, configurarlo AHÍ MISMO.
//
// ⚠️ SIN `server-only` NI `'use client'`, a propósito: lo usan la capa de datos (lib/curso-datos.ts,
// en cada pedido del portal), la invitación (lib/curso-invitar.ts), las actions y los modales de
// invitar, y los tests lo EJECUTAN. No toca la base: recibe lo que ya se leyó.
//
// ── A QUÉ CURSOS ABRE UN ACCESO (punto 7) ─────────────────────────────────────
// El acceso del alumno es UNO por cliente (`curso_accesos`, la fila con `area` null): un link, una
// cookie, una versión. Hasta el 09/10/2026 abría TODO producto del que el lead es cliente (su casa en
// el CRM y sus filas de `cliente_entrega`). Desde la mig 0232 la fila dice además QUÉ productos abre
// (`productos bigint[]`):
//   · NULL = todos sus productos — lo de siempre, y lo de toda fila que ya existía (compatibilidad).
//   · un array = sólo ésos, y sólo mientras siga siendo cliente de cada uno (`productosVisibles`).
//
// ⚠️ LA LISTA LA ESCRIBE SÓLO UNA INVITACIÓN QUE SALIÓ (`productosTrasInvitar`, en la misma escritura
// que `invitacion_enviada_at`, `marcarInvitacion`). Escribirla al CREAR la fila —antes del mail— dejaba
// el mismo agujero del audio por otro lado: Leandro intentó invitar dos veces, desde dos productos, con
// el correo sin configurar; si cada intento fallido sumaba su producto, el invitado que sí salió
// terminaba abriendo los dos. Un intento que no llegó a nadie no le promete nada a nadie.
//
// ⚠️ NULL SE ACHICA SÓLO SI NADIE LO USÓ TODAVÍA (`yaSeLeDio`). Una fila que nació por otro camino
// (copiar el link en la ficha, la invitación automática del CRM sin su producto) abre todo; si al
// alumno ya le llegó algo (el mail, el WhatsApp con su link) o ya entró, achicarla le sacaría cursos
// que está usando, sin que nadie lo decida. Si no, la primera invitación por producto la acota: el
// link de la ficha no lo tiene nadie todavía.
//
// ⚠️ SUMAR, NUNCA REEMPLAZAR. Invitarlo a un segundo producto le suma ése; nunca le saca el primero.
// Sacarle un curso es «Quitar de este producto» (la regla del kanban, que `productosVisibles` cruza) o
// cortar el acceso.

/** Lo que una fila de acceso dice de sus productos. `null` = todos (lo de antes). */
export type ProductosDelAcceso = readonly number[] | null;

/** Un tope contra un array inflado a mano: muy por encima de cualquier negocio real. Es el CHECK de la 0232. */
const MAX_PRODUCTOS = 200;

const idValido = (n: number): boolean => Number.isInteger(n) && n > 0;

/**
 * Lo que llega de la base (o de un navegador) a una lista que se puede creer. Nunca tira.
 *
 * · `null` / `undefined` → `null` (todos: lo de antes).
 * · Un array (de números o de texto: un `bigint` puede llegar como texto, AGENTS.md) → los ids
 *   válidos, sin repetir, en el orden en que llegaron. Un array vacío es «ninguno», no «todos».
 * · El literal de Postgres (`'{10,39}'`) → igual que el array.
 * · ⚠️ CUALQUIER OTRA COSA → `[]` (ninguno), NO `null`. «No pude entender qué abre» no es «abre
 *   todo»: con `null` un valor ilegible le abriría al alumno todos los cursos del negocio.
 */
export function saneaProductos(x: unknown): number[] | null {
  if (x == null) return null;
  let crudo: unknown[] | null = null;
  if (Array.isArray(x)) crudo = x;
  else if (typeof x === 'string' && /^\{[\d,\s]*\}$/.test(x.trim())) crudo = x.trim().slice(1, -1).split(',').filter((s) => s.trim() !== '');
  if (!crudo) return [];
  const out: number[] = [];
  for (const v of crudo) {
    if (out.length >= MAX_PRODUCTOS) break;
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,15}\s*$/.test(v) ? Number(v) : NaN;
    if (idValido(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** ¿Este acceso abre el curso de este producto? (Sin mirar si sigue siendo cliente: eso es `productosVisibles`.) */
export function abreElProducto(abre: ProductosDelAcceso, productoId: number): boolean {
  return abre == null || abre.includes(productoId);
}

/**
 * Los productos cuyo curso VE el alumno: los suyos (la regla del kanban, `productosDelCliente`)
 * cruzados con los que abre su acceso. En el orden de `deCliente` (el del catálogo), que es el que
 * dibuja el portal.
 *
 * ⚠️ ES LA ÚNICA PUERTA de «qué cursos ve» (la usa `productosConCasaDelAlumno`, lib/curso-datos.ts, y
 * de ahí el portal, la comunidad del alumno y los mensajes del curso). Una segunda forma de cruzarlos
 * es una pantalla que le muestra un curso que el portal no le abre, o al revés.
 */
export function productosVisibles(deCliente: readonly number[], abre: ProductosDelAcceso): number[] {
  return abre == null ? [...deCliente] : deCliente.filter((p) => abre.includes(p));
}

/** Lo que una invitación necesita saber de la fila de acceso que ya existe. */
export type AccesoParaInvitar = {
  productos: ProductosDelAcceso;
  invitacionEnviadaAt?: string | null;
  /** El último WhatsApp del curso que le llegó con su link (mig 0211). */
  linkEnviadoAt?: string | null;
  ingresos?: number;
};

/** ¿A esta persona ya le llegó algo con este acceso, o ya entró? Entonces ya sabe qué abre. */
export function yaSeLeDio(a: Omit<AccesoParaInvitar, 'productos'> | null | undefined): boolean {
  if (!a) return false;
  return !!a.invitacionEnviadaAt || !!a.linkEnviadoAt || (a.ingresos ?? 0) > 0;
}

/**
 * ¿Ya está invitado a ESTE producto? Le salió el mail Y su acceso abre ese producto. Un alumno
 * invitado a Fiesta Music no está invitado a Service Delivery: para ése, «Invitar» no es un segundo
 * mail del mismo curso, es la primera invitación a otro.
 */
export function invitadoAlProducto(a: Pick<AccesoParaInvitar, 'productos' | 'invitacionEnviadaAt'> | null | undefined, productoId: number): boolean {
  return !!a?.invitacionEnviadaAt && abreElProducto(a.productos, productoId);
}

/** ¿Ya entró y ese producto se le abre? (el motivo `ya-entro`, por producto). */
export function entroAlProducto(a: Pick<AccesoParaInvitar, 'productos' | 'ingresos'> | null | undefined, productoId: number): boolean {
  return (a?.ingresos ?? 0) > 0 && abreElProducto(a?.productos ?? null, productoId);
}

/**
 * La lista que queda escrita cuando SALIÓ la invitación a `productoId`. Ver la cabecera.
 *
 *   · sin producto (la invitación de la ficha o del CRM que todavía no dicen cuál) → no se toca;
 *   · sin fila → sólo ése;
 *   · una lista → se le SUMA (nunca se reemplaza);
 *   · `null` (todos) → si ya se le dio, sigue en todos; si no, sólo ése.
 */
export function productosTrasInvitar(a: AccesoParaInvitar | null | undefined, productoId: number | null | undefined): number[] | null {
  const actual = a ? saneaProductos(a.productos) : null;
  if (productoId == null || !idValido(productoId)) return actual;
  if (!a) return [productoId];
  if (actual != null) return actual.includes(productoId) ? actual : [...actual, productoId].slice(0, MAX_PRODUCTOS);
  return yaSeLeDio(a) ? null : [productoId];
}

/**
 * El acceso de una fila, visto DESDE un producto: si su lista no abre ese producto, para ese producto
 * no está invitado (`invitacionEnviadaAt: null`) — así «Clientes sin invitar», la celda «Acceso» y la
 * tarjeta del kanban de ESE producto lo ofrecen para invitar. Si la fila no trae `productos` (una
 * lectura que no la pidió), se devuelve tal cual: no se afirma nada que no se leyó.
 */
export function accesoEnProducto<A extends { invitacionEnviadaAt?: string | null; productos?: ProductosDelAcceso | undefined } | null>(a: A, productoId: number): A {
  if (!a || !('productos' in a) || a.productos === undefined) return a;
  if (abreElProducto(a.productos, productoId)) return a;
  return { ...a, invitacionEnviadaAt: null };
}

// ── Cuando el correo no sale (punto 10) ────────────────────────────────────────
// «Si falta la key del mail, configurarla AHÍ MISMO» — y decir de quién fue (AGENTS.md: «Un mensaje
// de error dice DE QUIÉN fue y QUÉ HACER»). La invitación sale con el remitente del NEGOCIO si tiene
// su correo conectado (`via: 'negocio'`, su key o su dominio) y si no, con el de MaKo (`via: 'mako'`).
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO (medido el 09/10/2026). Leandro vio «RESEND_API_KEY no
// configurada», cargó SU key, volvió a invitar y le salió LO MISMO: sin remitente, la invitación iba
// por MaKo, y la key que faltaba era la de la PLATAFORMA (en producción no está en el entorno: llega
// hidratando una credencial al arrancar, y `lib/resend.ts` la lee de `process.env` sin esperar esa
// hidratación). Lo que «lo arregló» fue cargar el remitente, que pasó la invitación a SU key.
// Por eso esta regla separa los dos casos: el texto que lee la persona no puede culparla de lo nuestro.

/** Por qué no salió, en lo que le importa a quien invita. `null` = no es de configuración (se reintenta). */
export type CorreoQueFallo = 'tuyo' | 'mako' | null;

/** Lo que dice Resend (o nuestro corte) cuando falta configurar algo: la key, el remitente, el dominio. */
const ES_DE_CONFIGURACION = /RESEND_API_KEY|api[\s_-]?key|no est[aá] configurad|remitente de prueba|resend\.dev|testing emails|not verified|verify (?:your|a) domain|domain (?:is )?not|invalid [`'"]?from|from[`'"]? field/i;

/**
 * Si el correo no salió por algo de CONFIGURACIÓN, de quién: `'tuyo'` (su correo conectado: la key, el
 * remitente o el dominio) o `'mako'` (el de la plataforma). Cualquier otra cosa (la red, un 5xx, el
 * límite de envíos) es `null`: se reintenta, no se configura.
 */
export function correoQueFallo(p: { error: string | null | undefined; via?: 'negocio' | 'mako' | null }): CorreoQueFallo {
  const e = (p.error ?? '').trim();
  if (!e || !ES_DE_CONFIGURACION.test(e)) return null;
  return p.via === 'negocio' ? 'tuyo' : 'mako';
}

// ── El borrador del formulario de invitar (punto 9) ────────────────────────────
// «Que se vuelva borrador siempre». Lo escrito vive en `sessionStorage` (por pestaña del navegador:
// sobrevive a cambiar de pestaña del modal, a cerrarlo, a irse a otra pantalla y volver, y a un F5),
// y NO en `localStorage`: son datos de una persona (nombre, email, teléfono), y en una computadora
// compartida no tienen por qué quedar para siempre. Se borra al invitar.

/**
 * Lo que se guarda del modal de invitar alumnos.
 *
 * ⚠️ «TAMBIÉN POR WHATSAPP» NO SE GUARDA, a propósito: nace apagada (item 21 del 08/10/2026), y una
 * casilla que manda un mensaje a una persona no vuelve prendida sola de un borrador.
 */
export type BorradorInvitar = {
  pestana: 'clientes' | 'nuevo';
  nuevo: { nombre: string; email: string; telefono: string; empresa: string; sinCobro: boolean };
  /** Los clientes elegidos de la lista y los emails que se editaron. */
  clientes: { elegidos: number[]; emails: Record<string, string> };
};

export const BORRADOR_VACIO: BorradorInvitar = {
  pestana: 'clientes',
  nuevo: { nombre: '', email: '', telefono: '', empresa: '', sinCobro: false },
  clientes: { elegidos: [], emails: {} },
};

/** La clave del borrador: por workspace (la pestaña del super admin puede mirar otro) y por producto. */
export const claveBorrador = (ws: number | null | undefined, productoId: number): string => `mako.invitar.${ws ?? 0}.${productoId}`;

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Lo guardado (cualquier cosa: lo escribió un navegador) a un borrador que se puede usar. Nunca tira. */
export function leerBorrador(raw: string | null | undefined): BorradorInvitar | null {
  if (!raw) return null;
  let x: unknown;
  try { x = JSON.parse(raw); } catch { return null; }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const n = (o.nuevo && typeof o.nuevo === 'object' ? o.nuevo : {}) as Record<string, unknown>;
  const c = (o.clientes && typeof o.clientes === 'object' ? o.clientes : {}) as Record<string, unknown>;
  const emails: Record<string, string> = {};
  if (c.emails && typeof c.emails === 'object' && !Array.isArray(c.emails)) {
    for (const [k, v] of Object.entries(c.emails as Record<string, unknown>).slice(0, 500)) {
      if (/^[1-9]\d{0,14}$/.test(k) && typeof v === 'string') emails[k] = v.slice(0, 320);
    }
  }
  return {
    pestana: o.pestana === 'nuevo' ? 'nuevo' : 'clientes',
    nuevo: {
      nombre: texto(n.nombre, 200), email: texto(n.email, 320), telefono: texto(n.telefono, 40), empresa: texto(n.empresa, 200),
      sinCobro: n.sinCobro === true,
    },
    // Ids de LEADS, con la misma limpieza que los de productos (enteros positivos, sin repetir).
    clientes: { elegidos: Array.isArray(c.elegidos) ? (saneaProductos(c.elegidos) ?? []) : [], emails },
  };
}

/** ¿Hay algo escrito? Un borrador vacío no se guarda (ni deja una clave colgada). */
export function borradorConAlgo(b: BorradorInvitar): boolean {
  const n = b.nuevo;
  return !!(n.nombre.trim() || n.email.trim() || n.telefono.trim() || n.empresa.trim() || n.sinCobro || b.clientes.elegidos.length || Object.keys(b.clientes.emails).length);
}
