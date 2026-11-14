// =============================================================================
// Marketing CoPilot — lo que el negocio configura del piloto fuera del Media Buyer (13/11/2026)
// =============================================================================
// Hoy: «¿con cuántas vistas se publica un reel de prueba?» (Martín, 13/11: nunca «graduar el reel de prueba»; MaKo propone el
// promedio de los competidores SEGUIDOS y la persona lo sube o lo baja). El número que propone MaKo sale de Competitor Spy
// (lib/spy-seguidos.ts → promedioDeSeguidos, la mediana de los últimos 20 reels de cada seguido y el promedio entre cuentas); lo que
// elige la persona se guarda acá, por negocio, en app_settings. Sin migración.
//
// ⚠️ EL PILOTO DE INSTAGRAM Y EL DE YOUTUBE SON DE MaKo PRO (14/11/2026, Martín): `FUNCIONES_SOLO_PRO`, 'piloto-redes'
//    (lib/topes-plan.ts). El de anuncios ya lo era (lib/media-buyer/store.ts, `PlanSinPiloto`); éste es su par. El candado del
//    servidor está ACÁ, donde se guarda la configuración (`guardarNumeroReel` tira `PlanSinPilotoRedes`; la ruta contesta 403
//    con `pasarAPro`), y la pantalla lo dibuja (`pilotoRedesPermitido`). Leer el número (el análisis) sigue abierto.
//    YouTube todavía no tiene nada que configurar: lo que se le sume va detrás de `pilotoRedesPermitido`, como el reel.
//    Ante la duda (no se pudo leer el plan), se deja pasar: `esEsencialDe` ya devuelve false.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { leerSeguidos, promedioDeSeguidos } from '@/lib/spy-seguidos';
import { esEsencialDe } from '@/lib/plan-esencial';
import { textoSoloPro } from '@/lib/topes-plan';
import type { NumeroDeRed } from '@/lib/spy-seguidos-reglas';

export const CLAVE_PILOTO_COPILOTO = 'marketing-copilot.piloto';
export type PilotoCoPilot = { reel: number | null };

/** El plan no trae el piloto de Instagram ni el de YouTube (MaKo Esencial). El par de `PlanSinPiloto` (lib/media-buyer/store.ts). */
export class PlanSinPilotoRedes extends Error {
  constructor() { super(textoSoloPro('piloto-redes')); this.name = 'PlanSinPilotoRedes'; }
}

/** ¿Puede prender o configurar el piloto de Instagram y el de YouTube? Esencial no; ante la duda, sí (`esEsencialDe`). */
export const pilotoRedesPermitido = async (ws: number): Promise<boolean> => !(await esEsencialDe(ws));

/** Lo que se acepta como número de un reel de prueba: vistas, entero, entre 50 y 10 millones. */
export const numeroDeReelOk = (n: unknown): number | null => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 50 && v <= 10_000_000 ? v : null;
};

function sanear(crudo: string | null): PilotoCoPilot {
  try { const o = crudo ? JSON.parse(crudo) as Record<string, unknown> : {}; return { reel: numeroDeReelOk(o.reel) }; } catch { return { reel: null }; }
}

export async function leerPilotoCoPilot(ws: number): Promise<PilotoCoPilot> {
  return sanear(await runWithWorkspace(ws, () => getSetting(CLAVE_PILOTO_COPILOTO)).catch(() => null));
}

/** Guarda el número que eligió la persona (leer estricto: un cambio sobre una lectura caída borraría lo demás). */
export async function guardarNumeroReel(ws: number, numero: number): Promise<PilotoCoPilot> {
  // El candado de Pro, antes que nada (14/11/2026): configurar el piloto de Instagram es lo nuevo que se frena.
  if (!(await pilotoRedesPermitido(ws))) throw new PlanSinPilotoRedes();
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
