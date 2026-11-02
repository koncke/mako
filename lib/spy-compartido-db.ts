import 'server-only';

// =============================================================================
// spy-compartido-db — leer y guardar la lectura que se comparte entre negocios (2/11/2026)
// =============================================================================
// Martín: «no tiene sentido de que uno analice a Alex Hormozi y luego otro también vuelva a
// analizar al mismo».
//
// La parte que toca la base. La REGLA —cuándo sirve la lectura de otro— es pura y vive en
// `lib/spy-compartido.ts`, con su test; acá sólo está el acceso.
//
// ⚠️ `spy_lecturas_canal` ES GLOBAL Y NO VA EN `TENANT_TABLES` (lib/workspace.ts). El proxy de
// `getTenantDb()` scopea las tablas de esa lista y deja pasar las demás sin tocar, que es
// exactamente lo que hace falta: esta tabla no tiene `workspace_id` porque **si lo tuviera diría a
// quién vigila cada negocio**, que es el dato que NO se comparte. Lo que se comparte es lo CARO: el
// resultado de leer un canal público, que es igual para cualquiera.
// =============================================================================

import { getTenantDb } from './workspace';
import { claveDeCanal, DIAS_QUE_SE_GUARDA } from './spy-compartido';

const T = 'spy_lecturas_canal';

export type LecturaCompartida = {
  leidoEn: string;
  piezas: unknown[];
  perfil: Record<string, unknown> | null;
};

/** Lo que YA leyó alguien de este canal, o `null`. Nunca tira: sin caché, se lee como siempre. */
export async function lecturaCompartida(canal: string, ref: string): Promise<LecturaCompartida | null> {
  const k = claveDeCanal(canal, ref);
  if (!k) return null;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from(T)
      .select('leido_en, piezas, perfil').eq('canal', k.canal).eq('ref', k.ref).maybeSingle();
    if (error || !data) return null;
    const piezas = Array.isArray(data.piezas) ? (data.piezas as unknown[]) : [];
    if (!piezas.length) return null;
    return { leidoEn: String(data.leido_en), piezas, perfil: (data.perfil as Record<string, unknown> | null) ?? null };
  } catch {
    return null;
  }
}

/**
 * Guarda lo que se acaba de leer, para que el próximo negocio no lo pague.
 *
 * ⚠️ NUNCA TIRA Y NUNCA BLOQUEA LA LECTURA: si esto falla, el negocio ya tiene sus piezas y lo
 * único que se pierde es el ahorro del siguiente. Hacer fallar «Revisar ahora» porque no se pudo
 * escribir una caché sería cambiar un ahorro por un error.
 */
export async function guardarLecturaCompartida(
  canal: string, ref: string, piezas: unknown[], perfil?: Record<string, unknown> | null,
): Promise<void> {
  const k = claveDeCanal(canal, ref);
  if (!k || !piezas.length) return;
  try {
    const db = await getTenantDb();
    await db.from(T).upsert(
      { canal: k.canal, ref: k.ref, leido_en: new Date().toISOString(), piezas, perfil: perfil ?? null },
      { onConflict: 'canal,ref' },
    );
  } catch (e) {
    console.error(`[spy] no pude guardar la lectura compartida de ${k.canal}:${k.ref}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Suma uno al contador de veces que esta fila le ahorró una lectura a alguien. */
export async function anotarAhorro(canal: string, ref: string): Promise<void> {
  const k = claveDeCanal(canal, ref);
  if (!k) return;
  // ⚠️ ES LA MEDIDA DE SI ESTO SIRVE. Si `ahorros` queda en cero, nadie mira a los mismos y la
  // tabla no se ganó el lugar: conviene saberlo antes de construirle nada encima.
  try {
    const db = await getTenantDb();
    const { data } = await db.from(T).select('ahorros').eq('canal', k.canal).eq('ref', k.ref).maybeSingle();
    const n = Number(data?.ahorros ?? 0) + 1;
    await db.from(T).update({ ahorros: n }).eq('canal', k.canal).eq('ref', k.ref);
  } catch { /* el ahorro es una métrica: que falle no puede costarle nada a nadie */ }
}

/** Lo más viejo que se guarda. La poda la corre quien tenga un cron; acá sólo se expone el tope. */
export const DIAS_DE_PODA = DIAS_QUE_SE_GUARDA;
