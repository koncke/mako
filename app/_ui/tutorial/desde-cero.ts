'use client';
// =============================================================================
// «VER EL ONBOARDING DESDE EL PRINCIPIO», SIN BORRAR NADA (18/11/2026)
// =============================================================================
// El Cerebro, 18/11: «un "ver el onboarding desde el principio" para el super admin, que lo deje recorrerlo de cero sin borrar datos».
// `?desde-cero=1` (en cualquier pantalla de quien ve el onboarding V2) prende un ENSAYO por esta pestaña del navegador
// (sessionStorage): los tutoriales de cada pestaña vuelven a arrancar como la primera vez y el reto de 7 días empieza de cero, con
// su estado en el navegador. No se escribe NADA en la base: ni lo visto (/api/recorridos) ni el reto (/api/reto). «Salir del ensayo»
// lo apaga y deja todo como estaba.
// =============================================================================
import { useSyncExternalStore } from 'react';
import type { EstadoReto } from '@/lib/reto/dias';

const CLAVE = 'mako.v2.desde-cero';
const CLAVE_VISTOS = 'mako.v2.desde-cero.vistos';
const CLAVE_RETO = 'mako.v2.desde-cero.reto';
const oyentes = new Set<() => void>();
let version = 0;
const avisar = () => { version++; for (const f of oyentes) f(); };
const leer = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const escribir = (k: string, v: string | null) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* sin storage: el ensayo dura lo que la página */ } };

/** Lo prende el `?desde-cero=1` de la URL (después vive en la pestaña, aunque se navegue sin el parámetro). */
function prenderSiLoPide(): void {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get('desde-cero') !== '1') return;
    // Sin tocar el historial: el router de Next lleva el suyo, y esto corre mientras se dibuja.
    if (!leer(CLAVE)) { escribir(CLAVE, '1'); escribir(CLAVE_VISTOS, '[]'); escribir(CLAVE_RETO, null); }
  } catch { /* es una comodidad */ }
}

export function enEnsayo(): boolean {
  prenderSiLoPide();
  return typeof window !== 'undefined' && leer(CLAVE) === '1';
}
/** ¿Está en el ensayo? Y su versión: cambia con cada cosa que se anota en él (para volver a leer). */
export function useEnsayo(): { activo: boolean; v: number } {
  const v = useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => (enEnsayo() ? version + 1 : 0), () => 0);
  return { activo: v > 0, v };
}
export function salirDelEnsayo(): void {
  escribir(CLAVE, null); escribir(CLAVE_VISTOS, null); escribir(CLAVE_RETO, null);
  avisar();
  try { window.location.reload(); } catch { /* */ }
}

/** Lo visto en el ensayo (los tutoriales), sin tocar /api/recorridos. */
export function vistoEnEnsayo(id: string): boolean {
  try { return (JSON.parse(leer(CLAVE_VISTOS) ?? '[]') as string[]).includes(id); } catch { return false; }
}
export function marcarVistoEnEnsayo(id: string): void {
  try { const v = new Set(JSON.parse(leer(CLAVE_VISTOS) ?? '[]') as string[]); v.add(id); escribir(CLAVE_VISTOS, JSON.stringify([...v])); } catch { /* */ }
  avisar();
}

/** El reto del ensayo, en el navegador. */
export function retoDelEnsayo(): EstadoReto | null {
  try { const r = leer(CLAVE_RETO); return r ? (JSON.parse(r) as EstadoReto) : null; } catch { return null; }
}
export function guardarRetoDelEnsayo(e: EstadoReto | null): void {
  escribir(CLAVE_RETO, e ? JSON.stringify(e) : null);
  avisar();
}
