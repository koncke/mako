// =============================================================================
// reels-datos — historial de guiones y estado del contexto de la tab Reels
// =============================================================================
// HISTORIAL: no hay tabla genérica de "piezas generadas" en el repo (el recon lo
// confirmó: landing_drafts es del Landing Generator, y contenido_posts guardaba
// solo lo ENVIADO a la tab Instagram, que salió el 06/10/2026). En vez de una
// migración nueva —que colisiona
// con la numeración de otras corridas— el historial vive como JSON en
// app_settings, el molde bendecido del repo para estado por-workspace sin
// migración (mismo criterio que lib/tab-onboarding-state.ts y
// lib/onboarding-state.ts). getSetting/setSetting ya scopean por workspace.
//
// Tope de 10 entradas a propósito: app_settings guarda texto, no es una tabla de
// historiales; 10 guiones (~3 KB c/u) son un valor chico y el historial es para
// «recuperar el de ayer», no un archivo eterno. Si algún día hace falta más, eso
// es una tabla con migración, no subir este número.
//
// ⚠️ Escritura read-modify-write sin lock: dos generaciones EXACTAMENTE
// simultáneas pueden perder una entrada del historial (no la pieza en pantalla).
// Aceptado: es un historial de conveniencia, no la fuente de verdad de nada.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { getSchema, getAnswers } from '@/lib/onboarding';
import type { PiezaReel } from '@/lib/ig-writer';

export const KEY_HISTORIAL_REELS = 'reels.historial';
const MAX_HISTORIAL = 10;

export type PiezaGuardada = {
  id: string;
  /** El tema que pidió el usuario (para el rótulo del historial). */
  pedido: string;
  pieza: PiezaReel;
  at: string;
  // Hasta el 06/10/2026 llevaba `borradorId` (la fila de contenido_posts si se había
  // enviado a publicación). Salió con la tab Instagram; las entradas viejas que lo
  // traigan no rompen nada: `esEntrada` no lo mira y nadie lo lee.
};

const esEntrada = (e: unknown): e is PiezaGuardada => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.at === 'string' && !!o.pieza && typeof o.pieza === 'object';
};

/** Historial del workspace (tolerante: basura o shape viejo → vacío). */
export async function leerHistorial(): Promise<PiezaGuardada[]> {
  try {
    const raw = await getSetting(KEY_HISTORIAL_REELS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter(esEntrada).slice(0, MAX_HISTORIAL) : [];
  } catch {
    return [];
  }
}

/** Agrega (o reemplaza por id) y recorta al tope. Devuelve el historial nuevo. */
export async function guardarEnHistorial(item: PiezaGuardada): Promise<PiezaGuardada[]> {
  const actual = await leerHistorial();
  const nuevo = [item, ...actual.filter((e) => e.id !== item.id)].slice(0, MAX_HISTORIAL);
  await setSetting(KEY_HISTORIAL_REELS, JSON.stringify(nuevo));
  return nuevo;
}

// ── Contexto del negocio (paso `reels_contexto`) ─────────────────────────────
// El paso NO pide redactar nada (regla de la skill): se DERIVA de lo que la app
// ya sabe. `listo` = hay al menos un grupo del perfil con datos; `faltan` lista
// los grupos vacíos para decir QUÉ falta y no un genérico "completa tu perfil".

export type EstadoContextoReels = { listo: boolean; faltan: string[] };

export async function estadoContextoReels(): Promise<EstadoContextoReels> {
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    const faltan = schema
      .filter((g) => !g.fields.some((f) => (answers[f.key] ?? '').trim()))
      .map((g) => g.label);
    return { listo: faltan.length < schema.length, faltan };
  } catch {
    // Consulta caída ≠ perfil vacío, pero acá el estado solo pinta un aviso
    // suave (nunca bloquea generar): degradar a "no listo" es lo conservador.
    return { listo: false, faltan: [] };
  }
}
