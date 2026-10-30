'use client';

// =============================================================================
// La memoria de las aperturas en el navegador: UNA lectura por página, y lo anotado se ve en el acto (29/10/2026)
// =============================================================================
// La lee /api/aperturas (lo de ESTA persona en ESTE negocio) una vez, y la comparten todas las piezas de la página: la estrella
// cerrada (su corto, su primera visita) y el hilo abierto deciden con lo MISMO. Lo que la persona decide se anota acá primero
// (`anotar` de lib/aperturas/reglas.ts, la misma cuenta que hace la ruta) y después se manda: un «Ahora no» calla ya, sin esperar.
// RESPALDO en el navegador, por huella (persona y negocio, la manda la ruta): con la base caída o una sesión sin fila propia, lo
// decidido en este navegador vale igual, como el de los recorridos (lib/recorridos.ts → claveLocal).
// ⚠️ MIENTRAS NO SE SABE (`memoria` null), NINGUNA APERTURA HABLA: si no, a quien ya dijo «Ahora no» se la mostraría un instante.
// SIN CSS ni componentes: lo importan motores que los tests cargan en node.
// Y LA APP Y LA IA PARA LA ESTRELLA CERRADA (`leerAppYIA`): la estrella sin el motor no hace pedidos propios
// (tests/ops-center-cliente.test.ts); lo lee acá, `?suIA=1` de /api/mako/chat (lo mismo que bloquea la caja), una vez cada 2
// minutos por página: pasar de una tab a otra no lo cambia.

import { useSyncExternalStore } from 'react';
import type { HechosOps } from '@/lib/aperturas/ops';
import { anotar, type AnotacionApertura, type DecisionApertura, type MemoriaAperturas } from '@/lib/aperturas/reglas';

export type EstadoMemoria = {
  /** null = todavía no se sabe. */
  memoria: MemoriaAperturas | null;
  /** Nunca vio una apertura: la primera lleva «¡Hola, <nombre>! Soy MaKo.». */
  primeraVez: boolean;
  nombre: string;
};

const PREFIJO = 'mako.aperturas.';
const SIN_SABER: EstadoMemoria = { memoria: null, primeraVez: false, nombre: '' };
let estado: EstadoMemoria = SIN_SABER;
let quien: string | null = null;
let pedida = false;
const oyentes = new Set<() => void>();
const avisar = () => { for (const f of oyentes) f(); };

function leerLocal(q: string | null): Record<string, AnotacionApertura> {
  if (!q) return {};
  try {
    const crudo = window.localStorage.getItem(PREFIJO + q);
    const o = crudo ? JSON.parse(crudo) : null;
    return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, AnotacionApertura> : {};
  } catch { return {}; }
}
function escribirLocal(q: string | null, m: MemoriaAperturas): void {
  if (!q) return;
  try { window.localStorage.setItem(PREFIJO + q, JSON.stringify(m)); } catch { /* modo privado: queda el server */ }
}

/** La lectura de la página. Lo de la base gana; lo del navegador suma lo que la base no supo (se anotó con la base caída). */
async function leer(): Promise<void> {
  try {
    const r = await fetch('/api/aperturas', { cache: 'no-store' });
    const j = await r.json().catch(() => null) as { ok?: boolean; guardado?: boolean; memoria?: MemoriaAperturas; primeraVez?: boolean; nombre?: string; quien?: string } | null;
    quien = typeof j?.quien === 'string' && /^[0-9a-f]{16}$/.test(j.quien) ? j.quien : null;
    const local = leerLocal(quien);
    if (r.ok && j?.ok) {
      const servidor = j.guardado ? j.memoria ?? {} : {};
      estado = { memoria: { ...local, ...servidor }, primeraVez: !!j.primeraVez && !Object.keys(local).length, nombre: j.nombre ?? '' };
    } else {
      // La base no contestó: decide lo del navegador (si no hay nada, callar es lo seguro: no se sabe qué dijo).
      estado = { memoria: Object.keys(local).length ? local : null, primeraVez: false, nombre: '' };
    }
  } catch {
    estado = { memoria: null, primeraVez: false, nombre: '' };
  }
  avisar();
}

function suscribir(f: () => void): () => void {
  oyentes.add(f);
  if (!pedida) { pedida = true; void leer(); }
  return () => { oyentes.delete(f); };
}

/** Lo que se sabe de la memoria (null mientras llega; en el server, null). */
export function useMemoriaAperturas(): EstadoMemoria {
  return useSyncExternalStore(suscribir, () => estado, () => SIN_SABER);
}

/**
 * Anota una decisión: en el acto en la página (y en el respaldo del navegador), y después en la base. Una que no llega queda en
 * el navegador: la próxima lectura la suma.
 */
export function anotarApertura(clave: string, d: DecisionApertura, extra: { valor?: string; pendiente?: string } = {}): void {
  const actual = estado.memoria ?? {};
  const nueva = { ...actual, [clave]: anotar(actual[clave], d, Date.now(), extra) };
  // Ya habló: la próxima no lleva el saludo.
  estado = { ...estado, memoria: nueva, primeraVez: false };
  escribirLocal(quien, nueva);
  avisar();
  try {
    void fetch('/api/aperturas', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ clave, d, ...extra }),
    }).catch(() => {});
  } catch { /* sin red: queda en el navegador */ }
}

/** La app y la IA de la última lectura, si es reciente (null = hay que leer). */
let appYIA: { at: number; h: HechosOps } | null = null;
const APP_Y_IA_VIGENTE_MS = 120_000;
export const appYIAReciente = (): HechosOps | null => (appYIA && Date.now() - appYIA.at < APP_Y_IA_VIGENTE_MS ? appYIA.h : null);

/** ¿Hay app de escritorio y su IA? Para la apertura del Cerebro con la estrella cerrada. null = no se pudo saber (calla). */
export async function leerAppYIA(): Promise<HechosOps | null> {
  const reciente = appYIAReciente();
  if (reciente) return reciente;
  try {
    const r = await fetch('/api/mako/chat?suIA=1', { cache: 'no-store' });
    const j = await r.json().catch(() => null) as { ok?: boolean; conectada?: boolean; app?: string } | null;
    if (!r.ok || !j?.ok) return null;
    const app = j.app === 'bloquea' || j.app === 'en-la-computadora' ? j.app : 'tiene';
    appYIA = { at: Date.now(), h: { app, iaConectada: j.conectada !== false } };
    return appYIA.h;
  } catch { return null; }
}
