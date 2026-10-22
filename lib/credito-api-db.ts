// =============================================================================
// El crédito de API de los planes Max, leído de la base (22/10/2026). Las reglas, en lib/credito-api.ts.
// =============================================================================
// SÓLO LEE. Tres lecturas, cada una con su falla dicha:
//   1. ¿Está vinculado el crédito de cada cuenta? Su clave en MaKo: el entorno o la fila cifrada del workspace de la
//      plataforma con el mismo nombre (lo mismo que lee `conCreditoDeLaPlataforma`, lib/anthropic.ts). Una lectura que
//      falla es «no sé», nunca «falta vincular».
//   2. ¿Qué negocio usa una de esas claves como SU Claude? Su `ANTHROPIC_API_KEY`, descifrada y comparada acá (el 22/10 el
//      ws10 tiene la de la cuenta 2). Lo que registra ese negocio como Anthropic sale del mismo crédito. Ni el ws de la
//      plataforma ni el del dueño entran: ahí caen filas de varias claves (lib/anthropic-usage.ts → wsDeLaFila).
//   3. Lo registrado en `anthropic_usage` desde el inicio del ciclo más viejo.
// ⚠️ Ninguna clave sale de acá: devuelve números, cuentas y números de workspace.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { OWNER_WS, wsSuperAdmin } from './workspace';
import { credWsEstricta, descifrarSecreto } from './credenciales';
import { CUENTAS_DEL_CREDITO, cicloDelCredito, resumenCredito, totalCredito, type FilaGasto, type LecturaCredito } from './credito-api';

export async function leerCreditoApi(ahora = Date.now()): Promise<LecturaCredito> {
  const db = getSupabaseServer();
  const ws = await wsSuperAdmin();

  const claves = new Map<string, string>();
  const vinculadas: Record<string, boolean | null> = {};
  for (const c of CUENTAS_DEL_CREDITO) {
    try {
      const v = process.env[c.clave]?.trim() || (await credWsEstricta(c.clave, ws))?.trim() || null;
      vinculadas[c.cuenta] = !!v;
      if (v) claves.set(c.cuenta, v);
    } catch {
      vinculadas[c.cuenta] = null;
    }
  }

  const wsConClave = new Map<number, string>();
  let negociosSinLeer = false;
  if (claves.size) {
    const { data, error } = await db.from('credenciales').select('workspace_id, valor_enc').eq('clave', 'ANTHROPIC_API_KEY');
    if (error) negociosSinLeer = true;
    for (const f of (data ?? []) as Array<{ workspace_id: number; valor_enc: string }>) {
      const w = Number(f.workspace_id);
      if (w === ws || w === OWNER_WS) continue;
      let v: string | null = null;
      try { v = descifrarSecreto(String(f.valor_enc), w, 'ANTHROPIC_API_KEY')?.trim() || null; } catch { negociosSinLeer = true; }
      for (const [cuenta, k] of claves) if (v && v === k) wsConClave.set(w, cuenta);
    }
  }

  const desde = Math.min(...CUENTAS_DEL_CREDITO.map((c) => cicloDelCredito(c.diaDeCobro, ahora).desde));
  let gastos: FilaGasto[] | null = null;
  try {
    gastos = await leerTodo<FilaGasto>(db, 'anthropic_usage', 'workspace_id, created_at, motivo, cuenta, cost_usd, provider, model', {
      filtros: (q) => q.gte('created_at', new Date(desde).toISOString()).eq('provider', 'anthropic'),
    });
  } catch {
    gastos = null;
  }

  const filas = resumenCredito({ vinculadas, gastos, wsConClave, ahora });
  return { ok: true, filas, total: totalCredito(filas), negociosSinLeer };
}
