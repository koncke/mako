// =============================================================================
// email-reputacion — el freno del email: cuenta los últimos envíos y, si hace falta, apaga el envío y avisa
// =============================================================================
// La regla vive en lib/email-freno.ts (pura, con test). Esto la lee contra la base y actúa. Lo llama el webhook de Resend
// cada vez que llega un rebote o una queja (app/api/webhooks/resend/route.ts), SIN sesión: corre con el workspace de la FILA
// del envío. Las columnas `rebotado_at` y `queja_at` son de la migración 0380: sin ellas la cuenta tira y no se frena
// (lo dice el log), que es lo mismo que pasaba antes de esto. NUNCA TIRA: el webhook sigue contestando 200.
// ⚠️ Mira los últimos 300 emails enviados desde que se prendió el envío (o de 7 días), no «las últimas 24 h»: ver el
// porqué en lib/email-freno.ts (ticket #76, el apagado de Mauricio del 10/11/2026 con «3 de 52»). Y desde el #93 (13/11) avisa
// desde 5 % de rebotes y apaga sólo desde 10 % (o 0,3 % de quejas).
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { getSupabaseServer } from './supabase';
import { envioEmailHabilitado, setEnvioEmail, KEY_ENVIO_EMAIL } from './envio-flags';
import { emitirAviso } from './avisos';
import { conteoDeLosUltimos, decidirFrenoEmail, desdeDelFreno, textoDelAvisoDeRebotes, textoDelFreno, FRENO_EMAIL, type ConteoEmail, type EnvioParaFreno } from './email-freno';

/** El aviso del catálogo (lib/avisos-catalogo.ts). */
export const TIPO_AVISO_EMAIL_FRENADO = 'email-frenado';
/** El de ANTES de apagar (ticket #93): los rebotes pasan el 5 % y el envío sigue. Uno por día como mucho. */
export const TIPO_AVISO_EMAIL_REBOTES = 'email-rebotes';

/**
 * Cuándo se prendió el envío de email del negocio: el `updated_at` de la setting si hoy vale 'true'. null si no hay setting
 * (el dueño hereda el env), si está apagado o si no se pudo leer: entonces el freno mira sus 7 días, que es más, nunca menos.
 */
async function prendidoAt(): Promise<string | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  try {
    const { data, error } = await getSupabaseServer().from('app_settings').select('value, updated_at').eq('workspace_id', ws).eq('key', KEY_ENVIO_EMAIL).maybeSingle();
    if (error || !data) return null;
    const fila = data as { value: unknown; updated_at: string | null };
    return fila.value === 'true' ? fila.updated_at ?? null : null;
  } catch { return null; }
}

/**
 * Los últimos `FRENO_EMAIL.ultimos` emails enviados del negocio del contexto (desde que se prendió el envío, o de 7 días), y
 * lo que de eso rebotó o se marcó como spam. TIRA si no puede leer los envíos.
 */
export async function conteoEmailDelFreno(): Promise<ConteoEmail> {
  const db = await getTenantDb();
  const desde = desdeDelFreno(Date.now(), await prendidoAt());
  const leer = async (tabla: 'nutricion_envios' | 'email_broadcast_envios'): Promise<EnvioParaFreno[]> => {
    let q = db.from(tabla).select('created_at, rebotado_at, queja_at').eq('estado', 'enviado').gte('created_at', desde);
    if (tabla === 'nutricion_envios') q = q.eq('canal', 'email');
    const { data, error } = await q.order('created_at', { ascending: false }).limit(FRENO_EMAIL.ultimos);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    return (data ?? []) as EnvioParaFreno[];
  };
  const [a, b] = await Promise.all([leer('nutricion_envios'), leer('email_broadcast_envios')]);
  return conteoDeLosUltimos([...a, ...b]);
}

export type ResultadoFreno =
  | { frenado: false; porque?: string; avisado?: true }
  | { frenado: true; motivo: 'rebotes' | 'quejas'; conteo: ConteoEmail };

/**
 * Después de un rebote o una queja del negocio `ws`: si los últimos envíos pasan el umbral de apagar (`decidirFrenoEmail`),
 * apaga el envío de email y le avisa; si sólo pasan el del aviso (#93), le avisa y el envío SIGUE. Si ya estaba apagado, no
 * hace nada (ni avisa dos veces). NUNCA TIRA.
 */
export async function revisarFrenoEmail(ws: number): Promise<ResultadoFreno> {
  try {
    return await runWithWorkspace(ws, async () => {
      if (!(await envioEmailHabilitado())) return { frenado: false, porque: 'ya estaba apagado' };
      const conteo = await conteoEmailDelFreno();
      const f = decidirFrenoEmail(conteo);
      if (!f.frena && f.avisa) {
        await emitirAviso({
          ws, tipo: TIPO_AVISO_EMAIL_REBOTES, titulo: 'Están rebotando tus emails', texto: textoDelAvisoDeRebotes(f, conteo),
          categoria: 'aviso', semaforo: 'amarillo', link: '/email', dedupTtlMin: 1440,
        }).catch((e: unknown) => console.error(`[email-reputacion] aviso de rebotes (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`));
        return { frenado: false, avisado: true };
      }
      if (!f.frena) return { frenado: false };
      await setEnvioEmail(false);
      await emitirAviso({
        ws, tipo: TIPO_AVISO_EMAIL_FRENADO, titulo: 'Apagué el envío de email', texto: textoDelFreno(f, conteo),
        categoria: 'aviso', semaforo: 'rojo', link: '/email', dedupTtlMin: 60,
      }).catch((e: unknown) => console.error(`[email-reputacion] aviso del freno (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`));
      return { frenado: true, motivo: f.motivo, conteo };
    });
  } catch (e) {
    console.error(`[email-reputacion] el freno del email (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
    return { frenado: false, porque: 'no pude contar' };
  }
}
