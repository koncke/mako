// =============================================================================
// spy-caricatura-base.mjs — la base y el Storage de la cola de caricaturas, para los scripts del Runner (4/11/2026)
// =============================================================================
// Lo comparten `spy-caricaturas-pendientes.mjs` y `spy-caricatura-guardar.mjs`: un solo lugar que lee los competidores
// y los registros (`spy.caricaturas`) de TODOS los negocios, escribe con compare-and-set y sube al Storage. La lógica
// (qué es pendiente, qué se marca) está en lib/spy-caricatura-cola.ts: la misma que usa el servidor.
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno (`--env-file=<clon>/.env.local`). Nunca imprime
// una clave.
// =============================================================================
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { CLAVE_CARICATURAS } from '../lib/spy-caricatura-reglas.ts';
import { referenteDeCompetidor } from '../lib/spy-caricatura.ts';
import { BUCKET_MINIATURAS, rutaDeMiniatura, tipoDeImagen } from '../lib/spy-miniaturas.ts';
import { leerTodo } from '../lib/supabase-paginado.ts';

export function depsDeLaBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: corre con --env-file=<clon>/.env.local.');
    process.exit(2);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    /** Todos los competidores de todos los negocios. El nombre se lee SÓLO para saber si es un referente: no sale. */
    async todos() {
      const filas = await leerTodo(sb, 'spy_competidores', 'id, workspace_id, nombre, instagram, youtube_id, tiktok, avatar', { orden: 'id' });
      return filas.map((f) => ({
        ws: Number(f.workspace_id), id: Number(f.id), instagram: f.instagram, youtube_id: f.youtube_id, tiktok: f.tiktok,
        avatar: f.avatar, referente: !!referenteDeCompetidor(f),
      }));
    },
    async leer(ws) {
      const { data, error } = await sb.from('app_settings').select('value, updated_at').eq('workspace_id', ws).eq('key', CLAVE_CARICATURAS).maybeSingle();
      if (error) throw new Error(`No pude leer las caricaturas del negocio ${ws}: ${error.message}`);
      return { crudo: data?.value ?? null, version: data ? String(data.updated_at ?? '') : null };
    },
    /** Compare-and-set por `updated_at` (el registro puede no entrar en una URL), siempre hacia adelante. */
    async cambiarSi(ws, version, nuevo) {
      if (version === null) {
        const { data, error } = await sb.from('app_settings')
          .upsert({ workspace_id: ws, key: CLAVE_CARICATURAS, value: nuevo, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
          .select('key');
        if (error) throw new Error(`No pude guardar las caricaturas del negocio ${ws}: ${error.message}`);
        return (data?.length ?? 0) > 0;
      }
      const despues = new Date(Math.max(Date.now(), (Date.parse(version) || 0) + 1)).toISOString();
      const base = sb.from('app_settings').update({ value: nuevo, updated_at: despues }).eq('workspace_id', ws).eq('key', CLAVE_CARICATURAS);
      const { data, error } = await (version ? base.eq('updated_at', version) : base.is('updated_at', null)).select('key');
      if (error) throw new Error(`No pude guardar las caricaturas del negocio ${ws}: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    /** El sha-256 de una foto nuestra, o null si no se pudo bajar. Sólo se usa con las fotos sin persona. */
    async huella(url) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) return null;
        return createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex');
      } catch { return null; }
    },
    /** La marca de «sin persona» por cuenta: una copia de su foto en spy/sin-persona/ (el bucket sólo acepta imágenes). */
    async guardarMarca(refs, foto) {
      const r = await fetch(foto, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`no pude bajar su foto (${r.status})`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const tipo = tipoDeImagen(bytes);
      if (!tipo) throw new Error('su foto no es una imagen');
      for (const ref of refs) await this.subir(rutaDeMiniatura('sin-persona', ref, tipo.ext), bytes, tipo.mime);
    },
    async subir(ruta, bytes, mime) {
      const { error } = await sb.storage.from(BUCKET_MINIATURAS).upload(ruta, bytes, { contentType: mime, upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from(BUCKET_MINIATURAS).getPublicUrl(ruta);
      if (!data?.publicUrl) throw new Error('el Storage no devolvió la URL');
      return data.publicUrl;
    },
  };
}
