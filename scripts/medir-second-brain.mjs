#!/usr/bin/env node
// =============================================================================
// medir-second-brain.mjs — qué guarda HOY el Second Brain de cada negocio, y qué se pierde (sólo lectura, 26/10/2026)
// =============================================================================
// Uso:  node --env-file=<.env.local con DATABASE_URL> scripts/medir-second-brain.mjs [--json salida.json]
//
// POR QUÉ: Martín (26/10/2026): «Revisa si el second brain realmente esta guardando todo el contexto de absolutamente todo,
// todo el tiempo». La respuesta del CÓDIGO está en docs/diseno-mako-recomienda.md (§1); ésta es la de los DATOS, negocio por
// negocio: de cada fuente, cuánto vivió el negocio y cuánto de eso llegó a lo que MaKo recuerda al contestar (`mako_knowledge`,
// que es lo único que lee el chat por `searchKnowledge`) o al motor de recomendaciones.
//
// SÓLO LECTURA, por construcción: todo va dentro de una transacción `read only` (Postgres rechaza cualquier escritura), con
// `statement_timeout`. Cuenta filas: no imprime ni un mensaje, ni un nombre de lead, ni el VALOR de una credencial (de las claves
// de IA sólo dice si la fila existe). No imprime la URL de conexión.
//
// Una tabla que no existe (una migración sin aplicar) sale como «sin tabla», no como 0: «no pude leer» no es «no hay».
// =============================================================================

import postgres from 'postgres';
import { writeFileSync } from 'node:fs';

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('Falta DATABASE_URL (corre con: node --env-file=<.env.local> scripts/medir-second-brain.mjs)'); process.exit(1); }
const iJson = process.argv.indexOf('--json');
const salidaJson = iJson > 0 ? process.argv[iJson + 1] : null;

/** Lo que se mide por negocio: nombre de la columna → consulta (con `$1` = workspace). Cada una devuelve UNA fila con `n` (y `ult`). */
const MEDIDAS = {
  // Lo que el negocio VIVIÓ
  wa_14d: `select count(*)::int n, max(wa_timestamp) ult from wa_mensajes where workspace_id = $1 and wa_timestamp > now() - interval '14 days'`,
  wa_charlas_lead_14d: `select count(distinct chat_jid)::int n, null::timestamptz ult from wa_mensajes where workspace_id = $1 and lead_id is not null and wa_timestamp > now() - interval '14 days'`,
  llamadas_120d: `select count(*)::int n, max(call_date)::timestamptz ult from closing_analyses where workspace_id = $1 and status = 'analizada' and call_date > now() - interval '120 days'`,
  llamadas_con_objeciones: `select count(*)::int n, null::timestamptz ult from closing_analyses where workspace_id = $1 and status = 'analizada' and jsonb_array_length(coalesce(objections, '[]'::jsonb)) > 0`,
  chats_mako_14d: `select count(*)::int n, max(created_at) ult from chart_chats where workspace_id = $1 and created_at > now() - interval '14 days'`,
  doer_wa_14d: `select count(*)::int n, max(created_at) ult from mako_doer_conv where workspace_id = $1 and created_at > now() - interval '14 days'`,
  offer_sesiones: `select count(*)::int n, max(updated_at) ult from offer_sesiones where workspace_id = $1`,
  envios_7d: `select count(*)::int n, max(created_at) ult from nutricion_envios where workspace_id = $1 and created_at > now() - interval '7 days'`,
  envios_fallo_7d: `select count(*)::int n, null::timestamptz ult from nutricion_envios where workspace_id = $1 and estado = 'fallo' and created_at > now() - interval '7 days'`,
  visitas_30d: `select count(*)::int n, max(created_at) ult from landing_visits where workspace_id = $1 and created_at > now() - interval '30 days'`,
  leads_120d: `select count(*)::int n, max(created_at) ult from leads where workspace_id = $1 and created_at > now() - interval '120 days'`,
  perdidos_con_motivo_120d: `select count(*)::int n, null::timestamptz ult from leads where workspace_id = $1 and estado_lead = 'perdido' and coalesce(motivo_perdida, '') <> '' and created_at > now() - interval '120 days'`,
  llamadas_marcadas_45d: `select count(*)::int n, null::timestamptz ult from leads where workspace_id = $1 and asistio_j1 is not null and junta_1_at > now() - interval '45 days'`,
  mb_decisiones: `select count(*)::int n, max(created_at) ult from media_buyer_decisiones where workspace_id = $1`,
  // Lo que MaKo RECUERDA al contestar (mako_knowledge: lo único que lee `searchKnowledge`)
  kn_total: `select count(*)::int n, max(created_at) ult from mako_knowledge where workspace_id = $1`,
  kn_whatsapp: `select count(*)::int n, max(updated_at) ult from mako_knowledge where workspace_id = $1 and fuente = 'whatsapp'`,
  kn_whatsapp_sin_indice: `select count(*)::int n, null::timestamptz ult from mako_knowledge where workspace_id = $1 and fuente = 'whatsapp' and estado <> 'indexado'`,
  recolector_libro: `select count(*)::int n, max(updated_at) ult from second_brain_recolectado where workspace_id = $1`,
  // Lo que decide si aprende: el interruptor y su IA (sólo si la fila existe; el valor no se lee)
  recolector_prendido: `select count(*)::int n, null::timestamptz ult from app_settings where workspace_id = $1 and key = 'second-brain.recolector' and value like '%"prendido":true%'`,
  claves_ia: `select count(*)::int n, null::timestamptz ult from credenciales where workspace_id = $1 and clave in ('ANTHROPIC_API_KEY','OPENAI_API_KEY','GEMINI_API_KEY')`,
  memoria_recomendaciones: `select count(*)::int n, null::timestamptz ult from app_settings where workspace_id = $1 and key = 'mako.recomendaciones.memoria'`,
};

const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });
try {
  const filas = await sql.begin('read only', async (tx) => {
    await tx`set local statement_timeout = '30s'`;
    const wss = await tx`select id, nombre, estado from workspaces order by id`;
    const out = [];
    for (const w of wss) {
      const fila = { ws: Number(w.id), nombre: w.nombre, estado: w.estado };
      for (const [k, q] of Object.entries(MEDIDAS)) {
        try {
          await tx`savepoint m`;
          const [r] = await tx.unsafe(q, [w.id]);
          fila[k] = r?.n ?? 0;
          if (r?.ult) fila[`${k}_ult`] = new Date(r.ult).toISOString().slice(0, 10);
          await tx`release savepoint m`;
        } catch (e) {
          await tx`rollback to savepoint m`;
          fila[k] = /does not exist/.test(String(e?.message)) ? 'sin tabla' : `error: ${String(e?.message).slice(0, 60)}`;
        }
      }
      out.push(fila);
    }
    return out;
  });
  const cols = ['ws', 'nombre', 'estado', 'wa_charlas_lead_14d', 'llamadas_120d', 'chats_mako_14d', 'doer_wa_14d', 'kn_total', 'kn_whatsapp', 'kn_whatsapp_sin_indice', 'recolector_prendido', 'claves_ia', 'envios_fallo_7d', 'visitas_30d', 'perdidos_con_motivo_120d', 'llamadas_marcadas_45d'];
  console.table(filas.map((f) => Object.fromEntries(cols.map((c) => [c, f[c]]))));
  if (salidaJson) { writeFileSync(salidaJson, JSON.stringify(filas, null, 2)); console.log(`Detalle completo en ${salidaJson}`); }
} finally {
  await sql.end();
}
