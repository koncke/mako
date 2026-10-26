// =============================================================================
// grabadores/ruteo-por-firma — de QUIÉN es un aviso que no lo dice: el negocio cuyo secreto lo firmó (server)
// =============================================================================
// Fireflies manda `{ event, meeting_id }` y Zoom valida su dirección con un `endpoint.url_validation` sin cuenta: ninguno
// dice de qué negocio es. Lo que sí traen es la FIRMA, hecha con el secreto que el negocio pegó en MaKo. Así que el
// negocio es aquél cuyo secreto la verifica: se prueban los secretos de los negocios que tienen esa credencial (unos
// pocos), comparando en tiempo constante. La firma autentica Y rutea; un aviso sin firma válida no es de nadie (401).
//
// ⚠️ ESTRICTO (AGENTS.md, «la lectura que decide de quién es el evento va estricta»): si la base no contesta, TIRA, y el
// webhook lo pasa por `responderFalloDeRuteo` (503 sólo a lo que se arregla reintentando). «No pude leer» no es «no es
// de nadie».
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { credDelClienteEstricta } from '../credenciales';

/** Los negocios que tienen guardada esa credencial. Tira si la base no contesta. */
async function negociosConLaClave(clave: string): Promise<number[]> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('workspace_id').eq('clave', clave);
  if (error) throw Object.assign(new Error(`credenciales (${clave}): ${error.message}`), { code: error.code });
  return [...new Set(((data ?? []) as Array<{ workspace_id: number }>).map((f) => Number(f.workspace_id)).filter(Number.isFinite))];
}

/**
 * El negocio cuyo secreto (`clave`) verifica el aviso, con su secreto; null = ninguno (firma inválida o sin secreto
 * cargado en ningún negocio). `verifica(secreto)` dice si la firma del aviso sale con ese secreto. Tira si no pudo leer.
 */
export async function negocioPorFirma(clave: string, verifica: (secreto: string) => boolean): Promise<{ ws: number; secreto: string } | null> {
  const verifican: Array<{ ws: number; secreto: string }> = [];
  for (const ws of await negociosConLaClave(clave)) {
    // Una fila que no se descifra no es la de este aviso (`ilegibleTira: false`): se sigue con la próxima.
    const secreto = await credDelClienteEstricta(clave, ws);
    if (secreto && verifica(secreto)) verifican.push({ ws, secreto });
  }
  // ⚠️ El secreto de Fireflies lo ESCRIBE la persona: dos negocios pueden haber puesto el mismo. Con dos que verifican, no
  // se sabe de cuál es, y elegir el primero sería meterle la reunión de uno al CRM del otro: no es de nadie.
  if (verifican.length > 1) {
    console.error(`[ruteo-por-firma] ${clave}: ${verifican.length} negocios (${verifican.map((v) => v.ws).join(', ')}) tienen el MISMO secreto — el aviso no se rutea`);
    return null;
  }
  return verifican[0] ?? null;
}
