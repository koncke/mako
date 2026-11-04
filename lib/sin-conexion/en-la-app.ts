// =============================================================================
// MaKo sin conexión — lo que hace la app CON conexión (navegador, 28/10/2026)
// =============================================================================
// Habla con /api/sin-conexion/{llave,copia} y guarda en IndexedDB (./almacen.ts) con la lógica de ./local.ts. Lo usan la
// fila de Settings › Instalar la app (activar, borrar) y app/_components/CopiaSinConexion.tsx (renovar cada `CADA_MS`).
// =============================================================================

import { almacenIdb, existeBase } from './almacen';
import { deBase64url, nombreDeBase } from './cifra';
import { activar, colaConLaLlaveDelServidor, copiasCon, guardarCopia, type PedirLlave, type ResultadoGuardar } from './local';
import { CADA_MS, normalizarEmail, type CopiaV1 } from './reglas';
import type { Operacion } from './cola';

const ULTIMA = 'mako-sc-ultima:';
/**
 * La hora del último intento que NO guardó. Después de un fallo se espera `CADA_MS` (verificación de 90d6410eb: sin esto,
 * cada vuelta a la pestaña volvía a pedir la llave y la copia entera, la lectura pesada, justo cuando el servidor anda mal).
 */
const INTENTO = 'mako-sc-intento:';
/** El caché del service worker (public/sw.js): «Borrar lo guardado» también lo saca, y el cascarón deja de renovarse. */
const CACHES_CASCARON = 'mako-sin-conexion-';
/** El último resultado de guardar en este navegador: la fila de Perfil dice si la copia dejó de renovarse y por qué. */
const ESTADO = 'mako-sc-estado:';

export const pedirLlave: PedirLlave = async (dispositivo) => {
  try {
    const r = await fetch(`/api/sin-conexion/llave?dispositivo=${encodeURIComponent(dispositivo)}`, { credentials: 'same-origin', cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; llave?: string; desconectada?: boolean; error?: string } | null;
    if (r.ok && j?.ok && typeof j.llave === 'string') return { ok: true, llave: deBase64url(j.llave) };
    return { ok: false, desconectada: j?.desconectada === true, error: j?.error || 'No pude pedir la llave de esta computadora.' };
  } catch {
    return { ok: false, desconectada: false, error: 'No hay conexión con MaKo.' };
  }
};

async function pedirCopia(): Promise<CopiaV1 | null> {
  const r = await fetch('/api/sin-conexion/copia', { credentials: 'same-origin', cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; copia?: CopiaV1 } | null;
  return r.ok && j?.ok && j.copia ? j.copia : null;
}

const baseDe = async (email: string) => nombreDeBase(normalizarEmail(email));

export async function estaActivado(email: string): Promise<boolean> {
  return existeBase(await baseDe(email));
}

/** ¿Toca guardar? Pasado `CADA_MS` (con 30 s de margen) de la última copia, y `CADA_MS` desde el último intento fallido. */
export async function tocaGuardar(email: string, ahora: number = Date.now()): Promise<boolean> {
  const nombre = await baseDe(email);
  const hora = (k: string) => { try { return Date.parse(localStorage.getItem(k + nombre) ?? ''); } catch { return NaN; } };
  const ultima = hora(ULTIMA);
  const intento = hora(INTENTO);
  if (Number.isFinite(ultima) && ahora - ultima < CADA_MS - 30_000) return false;
  return !(Number.isFinite(intento) && ahora - intento < CADA_MS);
}

/** Cuándo se guardó la última copia en este navegador (ISO), o null. */
export async function ultimaCopia(email: string): Promise<string | null> {
  try { return localStorage.getItem(ULTIMA + (await baseDe(email))); } catch { return null; }
}

export async function activarEnEstaComputadora(email: string, clave: string, repetida: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return activar({ email: normalizarEmail(email), clave, repetida, almacen: almacenIdb(await baseDe(email)), pedirLlave });
}

/** Guarda la copia ya. Sin activar en este navegador, no hace nada (y no crea la base). */
export async function guardarAhora(email: string): Promise<ResultadoGuardar> {
  const nombre = await baseDe(email);
  if (!(await existeBase(nombre))) return 'sin-activar';
  const r = await guardarCopia({ email: normalizarEmail(email), almacen: almacenIdb(nombre), pedirLlave, pedirCopia });
  try {
    if (r === 'guardada') { localStorage.setItem(ULTIMA + nombre, new Date().toISOString()); localStorage.removeItem(INTENTO + nombre); }
    else if (r !== 'sin-activar') localStorage.setItem(INTENTO + nombre, new Date().toISOString());
    if (r === 'desconectada') { localStorage.removeItem(ULTIMA + nombre); localStorage.removeItem(ESTADO + nombre); localStorage.removeItem(INTENTO + nombre); }
    else localStorage.setItem(ESTADO + nombre, r);
  } catch { /* sin localStorage: la copia igual quedó */ }
  return r;
}

/** El último resultado de guardar, o null. `otra-llave` = hay que elegir la clave de nuevo. */
export async function ultimoResultado(email: string): Promise<ResultadoGuardar | null> {
  try { return localStorage.getItem(ESTADO + (await baseDe(email))) as ResultadoGuardar | null; } catch { return null; }
}

// ── La cola (T2): lo escrito sin conexión, para subirlo con el OK de la persona ──

/** Cuántos cambios esperan en este navegador, sin descifrar nada (ni pedir la llave). 0 sin activar. */
export async function cuantosSinSubir(email: string): Promise<number> {
  const nombre = await baseDe(email);
  if (!(await existeBase(nombre))) return 0;
  return (await almacenIdb(nombre).leerCola().catch(() => [])).length;
}

/**
 * La cola descifrada con la llave del servidor, y la copia del negocio para nombrar cada cambio («Nota en Juan Pérez»).
 * `otra-llave`: se rotó el secreto del servidor y lo escrito no abre con la llave de hoy (sólo con la clave, sin conexión).
 */
export async function leerColaParaSubir(email: string): Promise<{ ok: true; cola: Operacion[]; copias: CopiaV1[] } | { ok: false; motivo: 'sin-activar' | 'otra-llave' | 'sin-llave' }> {
  const nombre = await baseDe(email);
  if (!(await existeBase(nombre))) return { ok: false, motivo: 'sin-activar' };
  const almacen = almacenIdb(nombre);
  const r = await colaConLaLlaveDelServidor({ email: normalizarEmail(email), almacen, pedirLlave });
  if (!r.ok) return r;
  return { ok: true, cola: r.cola, copias: await copiasCon({ email: normalizarEmail(email), llave: r.llave, almacen }) };
}

/** Saca UN cambio de la cola (ya subido, o descartado por la persona). */
export async function sacarDeLaCola(email: string, id: string): Promise<void> {
  await almacenIdb(await baseDe(email)).sacarDeCola(id);
}

export async function borrarLoGuardado(email: string): Promise<void> {
  const nombre = await baseDe(email);
  await almacenIdb(nombre).borrar();
  try { localStorage.removeItem(ULTIMA + nombre); localStorage.removeItem(ESTADO + nombre); localStorage.removeItem(INTENTO + nombre); } catch { /* nada */ }
  // El cascarón del service worker deja de renovarse (y de bajarse en cada arranque). El service worker queda: es el de los avisos.
  try {
    if (typeof caches !== 'undefined') for (const n of await caches.keys()) if (n.startsWith(CACHES_CASCARON)) await caches.delete(n);
  } catch { /* sin caché: nada que sacar */ }
}
