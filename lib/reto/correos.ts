import 'server-only';
// =============================================================================
// LOS CORREOS DEL RETO: «Día N del reto de MaKo», uno por día (18/11/2026)
// =============================================================================
// Una vuelta por día, desde el cron que ya corre a las 13:00 UTC (10:00 de Argentina: app/api/cron/aviso-fin-de-prueba), para no
// sumar otro cron. Recorre los negocios con reto (`app_settings` → `reto.estado`), y al que se le abrió un día nuevo le manda el
// correo de ese día a sus admins (lib/reto/dias.ts → correoDelDia), sólo a quien ve el onboarding V2 (lib/onboarding-v2/revision.ts),
// y anota `avisado` para no mandarlo dos veces. Nunca tira por un negocio.
// =============================================================================
import { getSupabaseServer } from '../supabase';
import { avisarDePlataforma } from '../invitaciones';
import { linkApp } from '../app-url';
import { veOnboardingV2 } from '../onboarding-v2/revision';
import { CLAVE_RETO, correoDelDia, diaParaAvisar, leerEstado } from './dias';

export type VueltaReto = { revisados: number; avisados: number; errores: number };

export async function avisarDiasDelReto(opts: { ahoraMs?: number; enSeco?: boolean } = {}): Promise<VueltaReto> {
  const ahora = opts.ahoraMs ?? Date.now();
  const db = getSupabaseServer();
  const { data, error } = await db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETO).limit(500);
  if (error) throw new Error(`No pude leer los retos: ${error.message}`);
  let avisados = 0, errores = 0;
  for (const fila of (data ?? []) as Array<{ workspace_id: number; value: unknown }>) {
    const ws = Number(fila.workspace_id);
    const e = leerEstado(fila.value);
    if (!e) continue;
    const dia = diaParaAvisar(e, ahora);
    if (dia == null) continue;
    try {
      const { data: us, error: e2 } = await db.from('usuarios').select('email, rol_ws, estado').eq('workspace_id', ws).limit(20);
      if (e2) throw new Error(e2.message);
      const para = [...new Set(((us ?? []) as Array<{ email: string | null; rol_ws: string | null; estado?: string | null }>)
        .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null) && u.estado !== 'suspendido')
        .map((u) => u.email!.trim().toLowerCase()))]
        .filter((email) => veOnboardingV2({ email, ws }));
      if (!para.length) continue;
      if (opts.enSeco) { avisados++; continue; }
      const m = correoDelDia(dia, linkApp('/second-brain?reto=1', ws));
      let salio = false;
      for (const to of para) {
        const r = await avisarDePlataforma({ to, tag: 'reto-dia', asunto: m.asunto, preheader: m.preheader, cuerpo: m.cuerpo, idempotencyKey: `reto-${ws}-${dia}-${to}` });
        if (r.enviado) salio = true; else console.warn(`[reto] no salió el día ${dia} a ${to} (ws ${ws}): ${r.error ?? 'sin detalle'}`);
      }
      if (!salio) { errores++; continue; }
      avisados++;
      const { error: e3 } = await db.from('app_settings').update({ value: JSON.stringify({ ...e, avisado: dia }) }).eq('workspace_id', ws).eq('key', CLAVE_RETO);
      if (e3) console.warn(`[reto] no pude anotar el día ${dia} avisado (ws ${ws}): ${e3.message}`);
    } catch (x) {
      errores++;
      console.error(`[reto] correo del día ${dia} (ws ${ws}):`, x instanceof Error ? x.message : String(x));
    }
  }
  return { revisados: (data ?? []).length, avisados, errores };
}
