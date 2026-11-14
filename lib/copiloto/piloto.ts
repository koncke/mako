// =============================================================================
// Marketing CoPilot — lo que el negocio configura del piloto fuera del Media Buyer (13/11/2026)
// =============================================================================
// Hoy: «¿con cuántas vistas se publica un reel de prueba?» (Martín, 13/11: nunca «graduar el reel de prueba»; MaKo propone el
// promedio de los competidores SEGUIDOS y la persona lo sube o lo baja). El número que propone MaKo sale de Competitor Spy
// (lib/spy-seguidos.ts → promedioDeSeguidos, la mediana de los últimos 20 reels de cada seguido y el promedio entre cuentas); lo que
// elige la persona se guarda acá, por negocio, en app_settings. Sin migración.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { leerSeguidos, promedioDeSeguidos } from '@/lib/spy-seguidos';
import type { NumeroDeRed } from '@/lib/spy-seguidos-reglas';
import type { RitmoNevera } from './nevera-reglas';
import { pilotoDeFabrica, sanearPilotoRedes } from './piloto-redes';

export const CLAVE_PILOTO_COPILOTO = 'marketing-copilot.piloto';
/** `redes`: lo del piloto de Instagram y YouTube (./piloto-redes.ts), crudo; se sanea al leerlo contra lo de fábrica. */
export type PilotoCoPilot = { reel: number | null; redes?: Record<string, unknown> };

/** Lo que se acepta como número de un reel de prueba: vistas, entero, entre 50 y 10 millones. */
export const numeroDeReelOk = (n: unknown): number | null => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 50 && v <= 10_000_000 ? v : null;
};

// ⚠️ `redes` VIAJA: guardar el número del reel reescribe el setting entero desde esto, y sin ella se borraba el piloto de las redes.
function sanear(crudo: string | null): PilotoCoPilot {
  try {
    const o = crudo ? JSON.parse(crudo) as Record<string, unknown> : {};
    const redes = o.redes && typeof o.redes === 'object' && !Array.isArray(o.redes) ? o.redes as Record<string, unknown> : undefined;
    return { reel: numeroDeReelOk(o.reel), ...(redes ? { redes } : {}) };
  } catch { return { reel: null }; }
}

/** El piloto de Instagram y YouTube, saneado contra lo de fábrica (que sale del ritmo de la nevera). */
export async function leerPilotoRedes(ws: number, ritmo: RitmoNevera | null): Promise<ReturnType<typeof sanearPilotoRedes>> {
  return sanearPilotoRedes((await leerPilotoCoPilot(ws)).redes, pilotoDeFabrica(ritmo));
}

/** Guarda lo de UNA red (o las dos), saneado. Lee estricto antes: un cambio sobre una lectura caída borraría lo demás. */
export async function guardarPilotoRedes(ws: number, cambio: { instagram?: unknown; youtube?: unknown }, ritmo: RitmoNevera | null): Promise<ReturnType<typeof sanearPilotoRedes>> {
  return runWithWorkspace(ws, async () => {
    const actual = sanear(await getSettingEstricto(CLAVE_PILOTO_COPILOTO));
    const crudo = { ...(actual.redes ?? {}), ...(cambio.instagram ? { instagram: cambio.instagram } : {}), ...(cambio.youtube ? { youtube: cambio.youtube } : {}) };
    const saneado = sanearPilotoRedes(crudo, pilotoDeFabrica(ritmo));
    // Se guarda lo saneado de las redes que vinieron (o que ya estaban): nunca lo de fábrica de una red que no se tocó.
    const redes = { ...(crudo.instagram ? { instagram: saneado.instagram } : {}), ...(crudo.youtube ? { youtube: saneado.youtube } : {}) };
    await setSetting(CLAVE_PILOTO_COPILOTO, JSON.stringify({ ...actual, redes }));
    return sanearPilotoRedes(redes, pilotoDeFabrica(ritmo));
  });
}

export async function leerPilotoCoPilot(ws: number): Promise<PilotoCoPilot> {
  return sanear(await runWithWorkspace(ws, () => getSetting(CLAVE_PILOTO_COPILOTO)).catch(() => null));
}

/** Guarda el número que eligió la persona (leer estricto: un cambio sobre una lectura caída borraría lo demás). */
export async function guardarNumeroReel(ws: number, numero: number): Promise<PilotoCoPilot> {
  const n = numeroDeReelOk(numero);
  if (n == null) throw new Error('El número tiene que ser de 50 vistas para arriba.');
  return runWithWorkspace(ws, async () => {
    const actual = sanear(await getSettingEstricto(CLAVE_PILOTO_COPILOTO));
    const nuevo = { ...actual, reel: n };
    await setSetting(CLAVE_PILOTO_COPILOTO, JSON.stringify(nuevo));
    return nuevo;
  });
}

/** Lo que dibuja el CoPilot del número de un reel de prueba: lo que propone Spy, lo que eligió la persona y de dónde sale. */
export type NumeroDelReel = {
  seguidos: number;
  /** El promedio de los seguidos (lo que propone MaKo), o null con su explicación. */
  propuesto: number | null;
  /** El que vale: lo que eligió la persona, o el propuesto. */
  numero: number | null;
  elegido: boolean;
  explicacion: string;
  competidores: Array<{ nombre: string; mediana: number | null }>;
};

export async function numeroDelReel(ws: number): Promise<NumeroDelReel> {
  const [seg, prom, guardado] = await Promise.all([
    runWithWorkspace(ws, () => leerSeguidos()).catch(() => ({ ids: [] as number[] })),
    runWithWorkspace(ws, () => promedioDeSeguidos()).catch(() => null),
    leerPilotoCoPilot(ws),
  ]);
  const reel: NumeroDeRed | undefined = prom?.redes.find((r) => r.red === 'reel');
  const propuesto = reel?.promedio != null ? Math.round(reel.promedio) : null;
  return {
    seguidos: seg.ids.length,
    propuesto,
    numero: guardado.reel ?? propuesto,
    elegido: guardado.reel != null,
    explicacion: reel?.explicacion ?? 'Todavía no sigues a ninguna cuenta: elige a tus competidores en Competitor Spy.',
    competidores: (reel?.competidores ?? []).map((c) => ({ nombre: c.nombre, mediana: c.mediana })),
  };
}
