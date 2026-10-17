// =============================================================================
// fotos-contacto — copiar la foto de WhatsApp de cada lead a NUESTRO bucket
// =============================================================================
// «Sí, guarda las fotos sin problemas» (Martín, 06/10/2026). La URL de WhatsApp vence a
// los 10 días; la copia en `avatars/leads/<ws>/<lead>.jpg` no. La ficha la usa antes que
// cualquier otra foto automática (lib/contacto-lead.ts → `candidatasDeFoto`).
//
// De dónde salen las URLs, y por qué así:
//   · la AGENDA de Evolution (`fetchContactosEvolution`): UNA request por workspace que lee
//     la base de Evolution, no la red de WhatsApp — no le suma tráfico a la línea no
//     oficial del cliente (que es lo que la expone a un baneo);
//   · nuestra tabla `evolution_contactos` (la llena el webhook).
// Lo que se baja es del CDN de WhatsApp (pps.whatsapp.net), tampoco de la línea.
//
// Qué se copia lo decide `leadsParaGuardarFoto` (pura, con test): sólo leads con una foto
// VIGENTE, sin colisiones de número, y sin copia o con copia de más de 30 días.
// ⚠️ Lo elegido por una persona (`avatar_url`/`icono`) no se toca nunca: esto escribe en
// `foto_auto_url`, que es otra columna.
//
// ⚠️ EL NOMBRE NO SE PUEDE ADIVINAR (17/10/2026): el bucket es público y la ruta era
// `leads/<ws>/<lead>.jpg`. Ahora lleva 128 bits al azar (lib/fotos-contacto-ruta.ts), la copia
// anterior se borra al refrescar, y `renombrarFotosAdivinables` muda las que quedaron con el
// formato viejo (la llama el mismo cron, en todos los negocios).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { fetchContactosEvolution } from './evolution';
import { fotosVigentes, leadsParaGuardarFoto } from './contacto-lead';
import { esRutaAdivinable, rutaDeFotoGuardada, rutaNuevaDeFoto } from './fotos-contacto-ruta';

const BUCKET = 'avatars';
/** Una foto de perfil de WhatsApp pesa 60-100 KB (medido). 2 MB es un tope de cordura. */
const TOPE_BYTES = 2 * 1024 * 1024;

export type ResultadoFotos = {
  contactos: number;
  conFotoVigente: number;
  aGuardar: number;
  guardadas: number;
  fallaron: number;
  errores: string[];
};

/**
 * Copia hasta `tope` fotos del workspace del contexto (el caller hace `runWithWorkspace`).
 * Nunca tira: lo que falla se cuenta y se devuelve.
 */
export async function guardarFotosDelWorkspace(ws: number, tope = 150): Promise<ResultadoFotos> {
  const res: ResultadoFotos = { contactos: 0, conFotoVigente: 0, aGuardar: 0, guardadas: 0, fallaron: 0, errores: [] };
  const db = await getTenantDb();

  const [agenda, propias, leads] = await Promise.all([
    fetchContactosEvolution().catch(() => []),
    leerTodo<{ telefono: string | null; foto_url: string | null }>(db, 'evolution_contactos', 'id, telefono, foto_url', {
      filtros: (q) => q.not('foto_url', 'is', null),
    }).catch(() => []),
    leerTodo<{ id: number; telefono: string | null; foto_auto_at: string | null; foto_auto_url: string | null }>(db, 'leads', 'id, telefono, foto_auto_at, foto_auto_url', {
      filtros: (q) => q.not('telefono', 'is', null),
    }),
  ]);

  // Sólo números de teléfono: un `@lid` o un grupo no son una línea que un lead pueda tener.
  const contactos = [
    ...agenda
      .filter((c) => c.remoteJid.endsWith('@s.whatsapp.net'))
      .map((c) => ({ telefono: c.remoteJid.split('@')[0], fotoUrl: c.fotoUrl })),
    ...propias.map((c) => ({ telefono: c.telefono, fotoUrl: c.foto_url })),
  ];
  res.contactos = contactos.length;
  const ahora = Date.now();
  const fotos = fotosVigentes(contactos, ahora);
  res.conFotoVigente = fotos.size;
  const plan = leadsParaGuardarFoto(leads, fotos, ahora);
  res.aGuardar = plan.length;

  const storage = getSupabaseServer().storage.from(BUCKET);
  const previa = new Map(leads.map((l) => [l.id, l.foto_auto_url]));
  for (const p of plan.slice(0, tope)) {
    try {
      const r = await fetch(p.url, { signal: AbortSignal.timeout(8000) });
      const tipo = r.headers.get('content-type') ?? '';
      if (!r.ok || !tipo.startsWith('image/')) { res.fallaron += 1; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > TOPE_BYTES) { res.fallaron += 1; continue; }
      const path = rutaNuevaDeFoto(ws, p.id);
      const up = await storage.upload(path, buf, { contentType: tipo, upsert: false });
      if (up.error) { res.fallaron += 1; res.errores.push(`subir ${p.id}: ${up.error.message}`); continue; }
      // `?v=`: queda por las URLs ya guardadas con la ruta fija; con una ruta nueva por copia, el
      // navegador y el CDN ya no muestran una foto vieja.
      const url = `${storage.getPublicUrl(path).data.publicUrl}?v=${ahora}`;
      const { error } = await db.from('leads').update({ foto_auto_url: url, foto_auto_at: new Date(ahora).toISOString() }).eq('id', p.id);
      if (error) {
        res.fallaron += 1; res.errores.push(`lead ${p.id}: ${error.message}`);
        await storage.remove([path]).catch(() => undefined);
        continue;
      }
      // La copia anterior se borra DESPUÉS de apuntar a la nueva: si esto falla, sobra un objeto,
      // nunca falta la foto. Sólo una ruta de ESTE lead y ESTE negocio (rutaDeFotoGuardada).
      const vieja = rutaDeFotoGuardada(previa.get(p.id), ws, p.id);
      if (vieja && vieja !== path) await storage.remove([vieja]).catch(() => undefined);
      res.guardadas += 1;
    } catch (e) {
      res.fallaron += 1;
      if (res.errores.length < 5) res.errores.push(`lead ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}

export type ResultadoRenombre = { viejas: number; renombradas: number; fallaron: number; errores: string[] };

/**
 * Muda las copias con nombre ADIVINABLE (`leads/<ws>/<lead>.jpg`) a una ruta al azar y actualiza
 * `foto_auto_url`. Idempotente: lo ya mudado no vuelve a matchear. Corre en el cron diario sobre
 * TODOS los negocios (también los pausados: la foto está a la vista igual) hasta que no quede
 * ninguna; medido el 17/10/2026, 106 copias en cinco negocios.
 */
export async function renombrarFotosAdivinables(ws: number, tope = 200): Promise<ResultadoRenombre> {
  const res: ResultadoRenombre = { viejas: 0, renombradas: 0, fallaron: 0, errores: [] };
  const db = getSupabaseServer();
  const { data, error } = await db.from('leads').select('id, foto_auto_url')
    .eq('workspace_id', ws).like('foto_auto_url', `%/avatars/leads/${ws}/%`).limit(1000);
  if (error) { res.errores.push(`leer: ${error.message}`); return res; }
  const viejas = ((data ?? []) as Array<{ id: number; foto_auto_url: string | null }>)
    .map((l) => ({ id: l.id, ruta: rutaDeFotoGuardada(l.foto_auto_url, ws, l.id) }))
    .filter((l): l is { id: number; ruta: string } => l.ruta != null && esRutaAdivinable(l.ruta));
  res.viejas = viejas.length;
  const storage = db.storage.from(BUCKET);
  for (const l of viejas.slice(0, tope)) {
    const nueva = rutaNuevaDeFoto(ws, l.id);
    const mv = await storage.move(l.ruta, nueva);
    if (mv.error) { res.fallaron += 1; if (res.errores.length < 5) res.errores.push(`mover ${l.id}: ${mv.error.message}`); continue; }
    const url = `${storage.getPublicUrl(nueva).data.publicUrl}?v=${Date.now()}`;
    const up = await db.from('leads').update({ foto_auto_url: url }).eq('id', l.id).eq('workspace_id', ws);
    if (up.error) {
      // La foto ya está en la ruta nueva: se devuelve a la vieja para no dejar la fila apuntando a nada.
      await storage.move(nueva, l.ruta).catch(() => undefined);
      res.fallaron += 1; if (res.errores.length < 5) res.errores.push(`lead ${l.id}: ${up.error.message}`);
      continue;
    }
    res.renombradas += 1;
  }
  return res;
}
