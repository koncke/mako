// =============================================================================
// email-reputacion — el freno del email: cuenta lo de las últimas 24 h y, si hace falta, apaga el envío y avisa
// =============================================================================
// La regla vive en lib/email-freno.ts (pura, con test). Esto la lee contra la base y actúa. Lo llama el webhook de Resend
// cada vez que llega un rebote o una queja (app/api/webhooks/resend/route.ts), SIN sesión: corre con el workspace de la FILA
// del envío. Las columnas `rebotado_at` y `queja_at` son de la migración 0380: sin ellas la cuenta tira y no se frena
// (lo dice el log), que es lo mismo que pasaba antes de esto. NUNCA TIRA: el webhook sigue contestando 200.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { envioEmailHabilitado, setEnvioEmail } from './envio-flags';
import { emitirAviso } from './avisos';
import { decidirFrenoEmail, textoDelFreno, type ConteoEmail } from './email-freno';

/** El aviso del catálogo (lib/avisos-catalogo.ts). */
export const TIPO_AVISO_EMAIL_FRENADO = 'email-frenado';

const haceUnDia = () => new Date(Date.now() - 86_400_000).toISOString();

/** Lo enviado por email en las últimas 24 h del negocio del contexto, y lo que de eso rebotó o se marcó como spam. TIRA si no puede leer. */
export async function conteoEmailUltimas24h(): Promise<ConteoEmail> {
  const db = await getTenantDb();
  const desde = haceUnDia();
  const contar = async (tabla: 'nutricion_envios' | 'email_broadcast_envios', marca: 'rebotado_at' | 'queja_at' | null): Promise<number> => {
    let q = db.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', 'enviado').gte('created_at', desde);
    if (tabla === 'nutricion_envios') q = q.eq('canal', 'email');
    if (marca) q = q.not(marca, 'is', null);
    const { count, error } = await q;
    if (error) throw new Error(`${tabla}${marca ? `.${marca}` : ''}: ${error.message}`);
    return count ?? 0;
  };
  const [e1, e2, r1, r2, q1, q2] = await Promise.all([
    contar('nutricion_envios', null), contar('email_broadcast_envios', null),
    contar('nutricion_envios', 'rebotado_at'), contar('email_broadcast_envios', 'rebotado_at'),
    contar('nutricion_envios', 'queja_at'), contar('email_broadcast_envios', 'queja_at'),
  ]);
  return { enviados: e1 + e2, rebotes: r1 + r2, quejas: q1 + q2 };
}

export type ResultadoFreno = { frenado: false; porque?: string } | { frenado: true; motivo: 'rebotes' | 'quejas'; conteo: ConteoEmail };

/**
 * Después de un rebote o una queja del negocio `ws`: si lo de las últimas 24 h pasa el umbral (`decidirFrenoEmail`), apaga el
 * envío de email y le avisa. Si ya estaba apagado, no hace nada (ni avisa dos veces). NUNCA TIRA.
 */
export async function revisarFrenoEmail(ws: number): Promise<ResultadoFreno> {
  try {
    return await runWithWorkspace(ws, async () => {
      if (!(await envioEmailHabilitado())) return { frenado: false, porque: 'ya estaba apagado' };
      const conteo = await conteoEmailUltimas24h();
      const f = decidirFrenoEmail(conteo);
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
