// =============================================================================
// MaKo sin conexión — lo que hace la app CON conexión (navegador, 28/10/2026)
// =============================================================================
// Habla con /api/sin-conexion/{llave,copia} y guarda en IndexedDB (./almacen.ts) con la lógica de ./local.ts. Lo usan la
// fila de Settings › Instalar la app (activar, borrar) y app/_components/CopiaSinConexion.tsx (renovar cada `CADA_MS`).
// =============================================================================

import { almacenIdb, existeBase } from './almacen';
import { deBase64url, nombreDeBase } from './cifra';
import { activar, guardarCopia, type PedirLlave, type ResultadoGuardar } from './local';
import { normalizarEmail, type CopiaV1 } from './reglas';

const ULTIMA = 'mako-sc-ultima:';
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
    if (r === 'guardada') localStorage.setItem(ULTIMA + nombre, new Date().toISOString());
    if (r === 'desconectada') { localStorage.removeItem(ULTIMA + nombre); localStorage.removeItem(ESTADO + nombre); }
    else localStorage.setItem(ESTADO + nombre, r);
  } catch { /* sin localStorage: la copia igual quedó */ }
  return r;
}

/** El último resultado de guardar, o null. `otra-llave` = hay que elegir la clave de nuevo. */
export async function ultimoResultado(email: string): Promise<ResultadoGuardar | null> {
  try { return localStorage.getItem(ESTADO + (await baseDe(email))) as ResultadoGuardar | null; } catch { return null; }
}

export async function borrarLoGuardado(email: string): Promise<void> {
  const nombre = await baseDe(email);
  await almacenIdb(nombre).borrar();
  try { localStorage.removeItem(ULTIMA + nombre); localStorage.removeItem(ESTADO + nombre); } catch { /* nada */ }
}
