// =============================================================================
// cliente — lo que el Panel, Crear y el editor de landings comparten y NO es React
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md.
//
// Antes de la integración había CUATRO copias del pedido a las rutas (subir.ts,
// paneles/PanelAgente.tsx, MiniaturaLanding.tsx y dialogos/piezas-gma.tsx), con cuatro plazos,
// cuatro textos de falla y una que TIRABA ante un corte de red mientras las otras tres devolvían
// `{ ok: false }`. Ahora vive acá y las demás re-exportan (AGENTS.md, «Una cosa, un lugar»).
//
// ⚠️ SIN 'use client', A PROPÓSITO. Una constante exportada de un módulo 'use client' llega como
// REFERENCIA DE CLIENTE a quien la importe desde el server, y desde otro cliente arrastra el
// módulo entero (con TipTap adentro, si es EditorLanding): la letra del chrome no se podía
// importar desde el Panel (AGENTS.md, «'use client' es una frontera de DATOS»). Este módulo no
// importa React ni valores de módulos `server-only`: sólo tipos, que se borran al compilar.
//
// Las reglas que los pedidos no negocian:
//   · NUNCA tiran: un corte de red, un plazo vencido o un cuerpo que no es JSON vuelven como
//     `{ ok: false, error }` con un texto corto que la pantalla puede mostrar tal cual.
//   · `res.ok` no es «salió bien»: manda el `ok` del CUERPO (AGENTS.md).
//   · Todo `fetch` lleva un plazo del NAVEGADOR (`AbortSignal.timeout`): el `maxDuration` de la
//     ruta acota al server, no al cliente (AGENTS.md, «Un tope que vive en la RUTA…»).
//   · El `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
// =============================================================================

import type { Falla, PedidoDocs, PedidoIA, PedidoImagenes, RespuestaIA } from '@/lib/editor-landing/api-tipos';
// `import type` de un módulo server-only: se borra al compilar, no viaja al navegador.
import type { RespuestaDocs } from '@/lib/editor-landing/server';
// Sólo tipos: lib/mako-pedidos.ts trae `AREA_KEYWORDS`, que no es para el navegador.
import type { Interpretacion } from '@/lib/mako-pedidos';
import type { Area } from '@/lib/api-mako/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// La letra del chrome
// ─────────────────────────────────────────────────────────────────────────────

/** La letra del chrome de Gamma (Instrument Sans, la libre más cercana a PP Mori: ver gamma.css). */
export const URL_FUENTE_CHROME = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap';

// ─────────────────────────────────────────────────────────────────────────────
// Plazos (el de la ruta + un margen)
// ─────────────────────────────────────────────────────────────────────────────

/** /api/landing-generator corta a 60 s. */
export const PLAZO_DOCS_MS = 65_000;
/** /api/landing-generator/ia corta a 300 s. */
export const PLAZO_IA_MS = 305_000;
/** /api/landing-generator/imagenes corta a 120 s (un video desde un enlace). */
export const PLAZO_IMAGENES_MS = 125_000;

/** Un pedido que viaja con `keepalive` no puede pesar más que esto (el tope del navegador es 64 KB). */
const TOPE_KEEPALIVE = 60_000;

export type FallaPedido = Falla & { cortado?: 'plazo' | 'usuario' };

/** ¿La falla es que la persona apretó «Detener»? (No es un error que haya que pintar en rojo.) */
export function cortadoPorUsuario(r: { ok: false }): boolean {
  return (r as FallaPedido).cortado === 'usuario';
}

/** Un número (el plazo en ms) o las opciones enteras. */
export type OpPedido = number | { ms?: number; signal?: AbortSignal; keepalive?: boolean };

/** Un plazo, y además el corte de quien llama (el botón «Detener»), en una sola señal. */
function conPlazo(ms: number, otra?: AbortSignal): AbortSignal {
  const plazo = AbortSignal.timeout(ms);
  if (!otra) return plazo;
  const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === 'function') return any.call(AbortSignal, [plazo, otra]);
  // Sin AbortSignal.any (Safari < 17.4): se encadenan a mano.
  const c = new AbortController();
  for (const s of [plazo, otra]) s.addEventListener('abort', () => c.abort(s.reason), { once: true });
  return c.signal;
}

/**
 * POST con JSON. Toda respuesta de estas rutas es `{ ok: true, … }` o `{ ok: false, error }`; lo
 * que no tenga esa forma (un 502 de la plataforma con HTML) se vuelve una falla con el código,
 * nunca un éxito.
 *
 * `keepalive` es para el último guardado al cerrar la pestaña: sólo si el cuerpo entra en el tope
 * del navegador (si no, el navegador rechaza el pedido entero en vez de mandarlo), y sin plazo
 * (la página se está yendo: no queda nadie para leer la respuesta).
 */
export async function postJson<T>(url: string, cuerpo: unknown, op: OpPedido): Promise<T | FallaPedido> {
  const o = typeof op === 'number' ? { ms: op } : op;
  const body = JSON.stringify(cuerpo);
  const keepalive = !!o.keepalive && body.length < TOPE_KEEPALIVE;
  const senal = keepalive ? undefined : conPlazo(o.ms ?? PLAZO_DOCS_MS, o.signal);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive, signal: senal });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* un cuerpo que no es JSON */ }
    if (data && typeof data === 'object' && typeof (data as { ok?: unknown }).ok === 'boolean') {
      const d = data as { ok: boolean; error?: unknown };
      if (!d.ok && typeof d.error !== 'string') return { ok: false, error: `Error ${res.status}` };
      return data as T | FallaPedido;
    }
    return { ok: false, error: res.ok ? 'Respuesta inválida' : `Error ${res.status}` };
  } catch {
    if (o.signal?.aborted) return { ok: false, error: 'Detenido', cortado: 'usuario' };
    if (senal?.aborted) return { ok: false, error: 'Tardó demasiado. Vuelve a intentar.', cortado: 'plazo' };
    return { ok: false, error: 'Sin conexión. Vuelve a intentar.' };
  }
}

/**
 * POST /api/landing-generator con un `PedidoDocs`; la respuesta, con el tipo de ESA acción. La
 * acción se infiere del literal (`pedirDocs({ accion: 'temas' })`) o se pasa explícita
 * (`pedirDocs<'temas'>(…)`).
 */
export function pedirDocs<A extends PedidoDocs['accion']>(cuerpo: Extract<PedidoDocs, { accion: A }>, op: OpPedido = PLAZO_DOCS_MS): Promise<RespuestaDocs<A> | FallaPedido> {
  return postJson<RespuestaDocs<A>>('/api/landing-generator', cuerpo, op);
}

/** POST /api/landing-generator/ia (MaKo). */
export function pedirIA(cuerpo: PedidoIA, op: OpPedido = PLAZO_IA_MS): Promise<RespuestaIA | FallaPedido> {
  return postJson<RespuestaIA>('/api/landing-generator/ia', cuerpo, op);
}

/** POST /api/landing-generator/imagenes. `T` es la forma del `ok: true` de esa acción. */
export function pedirImagenes<T = { ok: true; [k: string]: unknown }>(cuerpo: PedidoImagenes, op: OpPedido = PLAZO_IMAGENES_MS): Promise<T | FallaPedido> {
  return postJson<T>('/api/landing-generator/imagenes', cuerpo, op);
}

/**
 * /api/mako/pedidos (docs/diseno-mako-pedidos.md) contesta con reglas en lo que tarda leer la vista, y con la IA
 * hasta 7,5 s más (lib/mako-pedidos-ia.ts); el resto es para la sesión, la vista y las landings. Pasado esto el chat
 * no espera: sigue como siempre, con el mensaje entero a «editar».
 */
export const PLAZO_PEDIDOS_MS = 12_000;

/** POST /api/mako/pedidos: separa el mensaje del chat en pedidos (lo de la landing abierta y lo demás). */
export function pedirPedidos(
  cuerpo: { texto: string; tab: Area; actualId?: number | string | null; actualNombre?: string },
  op: OpPedido = PLAZO_PEDIDOS_MS,
): Promise<({ ok: true } & Interpretacion) | FallaPedido> {
  return postJson<{ ok: true } & Interpretacion>('/api/mako/pedidos', cuerpo, op);
}

// ─────────────────────────────────────────────────────────────────────────────
// Un archivo → su texto (Importar y el «+» de la caja)
// ─────────────────────────────────────────────────────────────────────────────

/** La ruta que lee un archivo (multipart, nunca una server action: tope de 1 MB) y su tope de subida. */
export const RUTA_IMPORTAR = '/api/landing-generator/importar';
export const TOPE_IMPORTAR_BYTES = 15 * 1024 * 1024;
/** /api/landing-generator/importar corta a 300 s (un PDF escaneado o una imagen se leen con IA). */
export const PLAZO_IMPORTAR_MS = 305_000;

/**
 * Sube un archivo (PowerPoint, Word, PDF, una imagen…) y devuelve su TEXTO, leído por el server con el
 * lector de la casa (`archivoATexto`). Lo usan «Importar» de Crear con IA y el «+» de la caja
 * «¿Qué vas a crear hoy?» (tanda 6: Martín, «que en ese + solo quede la opción de importar archivo y
 * otras opciones así, para subir imagen»). Nunca tira: toda falla vuelve con un texto corto.
 */
export async function leerArchivo(f: File, signal?: AbortSignal): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  if (f.size > TOPE_IMPORTAR_BYTES) return { ok: false, error: 'El archivo pesa más de 15 MB.' };
  const form = new FormData();
  form.append('file', f);
  const senal = conPlazo(PLAZO_IMPORTAR_MS, signal);
  try {
    // El ?ws= lo pega WsFetch.
    const res = await fetch(RUTA_IMPORTAR, { method: 'POST', body: form, signal: senal });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; texto?: unknown; error?: string } | null;
    if (!j?.ok || typeof j.texto !== 'string' || !j.texto.trim()) return { ok: false, error: j?.error || `No se pudo leer el archivo (${res.status}).` };
    return { ok: true, texto: j.texto };
  } catch {
    if (signal?.aborted) return { ok: false, error: 'Detenido' };
    if (senal.aborted) return { ok: false, error: 'Tardó demasiado. Prueba con un archivo más chico.' };
    return { ok: false, error: 'Sin conexión. Vuelve a intentar.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se recuerda en ESTE navegador (comodidades, nunca datos)
// ─────────────────────────────────────────────────────────────────────────────
// localStorage puede venir vacío o tirar (ventana privada, datos bloqueados): todo va en
// try/catch y la pantalla funciona igual sin él.

export function leerLocal<T>(clave: string, def: T): T {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : def;
  } catch {
    return def;
  }
}

export function guardarLocal(clave: string, valor: unknown): void {
  try { window.localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: queda en memoria */ }
}

const CLAVE_RECIENTES = 'gp.landings.recientes';
const TOPE_RECIENTES = 30;

/** id → cuándo se abrió por última vez desde este navegador («Recientes» del Panel). */
export function leerRecientes(): Record<string, number> {
  const r = leerLocal<Record<string, number>>(CLAVE_RECIENTES, {});
  return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
}

/**
 * Anota que esta landing se abrió AHORA. La llama el editor al montar (no sólo el Panel): una
 * landing abierta desde un link, un marcador o «Crear» también es reciente.
 */
export function marcarReciente(id: number): void {
  const r = { ...leerRecientes(), [String(id)]: Date.now() };
  const top = Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, TOPE_RECIENTES);
  guardarLocal(CLAVE_RECIENTES, Object.fromEntries(top));
}
