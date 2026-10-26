// =============================================================================
// prueba-plan — el aviso de «tu prueba gratis termina en 2 días» (25/10/2026)
// =============================================================================
// El Cerebro (25/10): «Recordatorio por email 2 días antes del cobro». Lo puro (cuándo toca, el texto) está en
// lib/prueba-plan-reglas.ts; acá, la lectura de las pruebas autorizadas de la plataforma y el envío, una vez por prueba.
//
// La marca de «ya avisado» es `cobros.prueba_aviso_at` (mig 0334). SIN la migración no hay marca: se avisa a las pruebas
// cuyo cobro cae entre 1 y 2 días después de AHORA, y como el cron corre una vez por día, cada prueba cae en una sola vuelta.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { avisarDePlataforma } from './invitaciones';
import { linkApp } from './app-url';
import { formatoMonto } from './pasarela-moneda';
import { avisoFinDePrueba, DIAS_AVISO_FIN_DE_PRUEBA, tocaAvisarFinDePrueba } from './prueba-plan-reglas';

const DIA_MS = 86_400_000;
const COLS = 'id, email, concepto, monto, moneda, inicio_at, alta_ws';

type FilaPrueba = { id: number; email: string | null; concepto: string; monto: number; moneda: string; inicio_at: string | null; alta_ws: number | null; prueba_aviso_at?: string | null };

export type VueltaAvisos = { revisadas: number; avisadas: number; errores: number; sinMarca: boolean };

/** Manda el aviso a cada prueba autorizada cuyo primer cobro es en los próximos 2 días. Nunca tira por una prueba. */
export async function avisarFinDePruebas(opts: { ahoraMs?: number; enSeco?: boolean } = {}): Promise<VueltaAvisos> {
  const ahoraMs = opts.ahoraMs ?? Date.now();
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const base = () => db.from('cobros').select(`${COLS}, prueba_aviso_at`)
    .eq('workspace_id', plataforma).eq('tipo', 'suscripcion').eq('estado', 'pendiente').eq('suscripcion_estado', 'activa')
    .like('creado_por', 'planes:%:prueba')
    .gt('inicio_at', new Date(ahoraMs).toISOString()).lte('inicio_at', new Date(ahoraMs + DIAS_AVISO_FIN_DE_PRUEBA * DIA_MS).toISOString())
    .limit(200);
  let filas: FilaPrueba[];
  let sinMarca = false;
  const { data, error } = await base().is('prueba_aviso_at', null);
  if (!error) filas = (data ?? []) as unknown as FilaPrueba[];
  else if (/prueba_aviso_at|column/.test(error.message)) {
    // Sin la mig 0334: la ventana de UN día (entre 1 y 2 días antes), así la vuelta diaria avisa una sola vez.
    sinMarca = true;
    const r = await db.from('cobros').select(COLS)
      .eq('workspace_id', plataforma).eq('tipo', 'suscripcion').eq('estado', 'pendiente').eq('suscripcion_estado', 'activa')
      .like('creado_por', 'planes:%:prueba')
      .gt('inicio_at', new Date(ahoraMs + (DIAS_AVISO_FIN_DE_PRUEBA - 1) * DIA_MS).toISOString())
      .lte('inicio_at', new Date(ahoraMs + DIAS_AVISO_FIN_DE_PRUEBA * DIA_MS).toISOString())
      .limit(200);
    if (r.error) throw new Error(`No pude leer las pruebas por terminar: ${r.error.message}`);
    filas = (r.data ?? []) as unknown as FilaPrueba[];
  } else throw new Error(`No pude leer las pruebas por terminar: ${error.message}`);

  let avisadas = 0, errores = 0;
  for (const f of filas) {
    if (!f.email || !f.inicio_at || !tocaAvisarFinDePrueba({ inicioAt: f.inicio_at, ahoraMs, avisadoAt: f.prueba_aviso_at ?? null })) continue;
    if (opts.enSeco) { avisadas++; continue; }
    try {
      // El concepto es «MaKo Pro · mensual» (`conceptoDelPlan`): el aviso nombra el plan.
      const nombrePlan = f.concepto.replace(/\s*·\s*mensual$/i, '');
      const linkPlan = f.alta_ws ? linkApp('/configuraciones/plan', f.alta_ws) : linkApp('/configuraciones/plan', null);
      const m = avisoFinDePrueba({ nombrePlan, monto: formatoMonto(f.monto, f.moneda), inicioAt: f.inicio_at, linkPlan });
      const r = await avisarDePlataforma({ to: f.email, tag: 'prueba-fin', asunto: m.asunto, preheader: 'Tu prueba gratis de MaKo termina pronto.', cuerpo: m.cuerpo });
      if (!r.enviado) { errores++; console.warn(`[prueba-plan] no salió el aviso de la prueba ${f.id}: ${r.error ?? 'sin detalle'}`); continue; }
      avisadas++;
      if (!sinMarca) {
        const { error: e2 } = await db.from('cobros').update({ prueba_aviso_at: new Date(ahoraMs).toISOString() }).eq('id', f.id).eq('workspace_id', plataforma);
        if (e2) console.warn(`[prueba-plan] no pude marcar el aviso de la prueba ${f.id}: ${e2.message}`);
      }
    } catch (e) {
      errores++;
      console.error(`[prueba-plan] aviso de la prueba ${f.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { revisadas: filas.length, avisadas, errores, sinMarca };
}
