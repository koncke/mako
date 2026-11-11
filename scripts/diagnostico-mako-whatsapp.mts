// =============================================================================
// diagnostico-mako-whatsapp — ¿por qué MaKo no contesta en WhatsApp? (SÓLO LECTURA, 11/11/2026)
// =============================================================================
// Uso (desde un worktree, con el .env.local del clon, que es PRODUCCIÓN — sólo lee):
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/diagnostico-mako-whatsapp.mts [--horas 24] [--env <.env.local>]
//
// Para qué: Martín, 10/11/2026, «Mako en WhatsApp no responde... SIEMPRE debe responder, haz un relevo de eso para que no ocurra
// más». MaKo se calla por seis causas distintas, y cada una tiene su arreglo. Este script las mira TODAS en una corrida, en el orden
// en que conviene descartarlas (docs/relevo/nube-mako-wa-responde.md):
//   1. la línea de MaKo, ¿conectada?, ¿y le llega algo? (Evolution, en Railway: `fetchInstances`, que es una lectura; y lo último que
//      entró a `mako_doer_buffer`: la línea SORDA del 9/11 mandaba y contestaba la sonda sin recibir nada);
//   2. el freno de la línea (`linea.freno.<instancia>`, lib/linea-freno.ts): desde el 11/11 la respuesta lo pasa, lo demás no;
//   3. el interruptor del doer (`mako.doer.activo` del ws1: 'false' lo apaga para TODOS los grupos);
//   4. la cola: mensajes de personas que quedaron sin turno (`mako_doer_buffer` pendientes de hace más de 5 minutos);
//   5. los turnos sin respuesta y las respuestas que WhatsApp no tomó (`mako_doer_conv`, `errores_app`).
// Y dice si el vigía de los grupos está prendido en este .env (en Vercel se mira aparte: `npx vercel env ls | grep VIGIA_GRUPOS`).
//
// ⛔ NUNCA ESCRIBE en la base ni le manda nada a nadie: no importa nada que envíe (ni lib/mako-grupo.ts ni lib/evolution.ts), y a
//    Evolution sólo le hace un GET. No imprime textos de mensajes: grupos por su negocio y los últimos 6 caracteres.
// Salida: el informe y código 0; si no pudo leer la base, el error y código 2.
// =============================================================================

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const REPO = process.cwd();
const CLON_DEFAULT = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const ENV = arg('--env') ?? (fs.existsSync(path.join(REPO, '.env.local')) ? path.join(REPO, '.env.local') : CLON_DEFAULT);
const HORAS = Math.max(1, Number(arg('--horas') ?? 24) || 24);
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });

const { getSupabaseServer } = await imp('lib/supabase.ts');
const { frenoVigente, textoDelFreno } = await imp('lib/mako-salida-reglas.ts');
const { incidentesDe, ESPERA_RESPUESTA_MS } = await imp('lib/vigia-mako-grupos.ts');

const db = getSupabaseServer();
const ahora = Date.now();
const desde = new Date(ahora - HORAS * 3600_000).toISOString();
const corto = (jid: string) => `…${jid.replace(/@g\.us$/, '').slice(-6)}`;
const hora = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const hallazgos: string[] = [];

async function leer<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string): Promise<T> {
  const { data, error } = await q;
  if (error) { console.error(`No pude leer ${que}: ${error.message}`); process.exit(2); }
  return data as T;
}

console.log(`Diagnóstico de MaKo en WhatsApp — últimas ${HORAS} h (${hora(desde)} → ahora)\n`);

// ── 1. La línea ─────────────────────────────────────────────────────────────
const voz = (await leer<Array<{ value: string }>>(db.from('app_settings').select('value').eq('workspace_id', 1).eq('key', 'mako.voz.instancia'), 'la línea de MaKo'))[0]?.value ?? null;
console.log(`1. La línea por la que habla MaKo en los grupos: ${voz ?? '(sin `mako.voz.instancia` en el ws1: MaKo no tiene por dónde hablar)'}`);
if (!voz) hallazgos.push('MaKo no tiene línea de voz configurada (`mako.voz.instancia` del ws1).');
const BASE = (process.env.EVOLUTION_BASE_URL ?? '').replace(/\/$/, '');
if (BASE && process.env.EVOLUTION_API_KEY) {
  try {
    const r = await fetch(`${BASE}/instance/fetchInstances`, { headers: { apikey: process.env.EVOLUTION_API_KEY }, signal: AbortSignal.timeout(20_000) });
    const lista = (await r.json()) as Array<{ name?: string; instanceName?: string; connectionStatus?: string; state?: string; _count?: { Message?: number } }>;
    for (const i of Array.isArray(lista) ? lista : []) {
      const nombre = i.name ?? i.instanceName ?? '?';
      if (!/^mako/i.test(nombre) && nombre !== voz) continue;
      const estado = i.connectionStatus ?? i.state ?? '?';
      console.log(`   · ${nombre}: ${estado}, ${i._count?.Message ?? '?'} mensajes guardados${nombre === voz ? '  ← la de los grupos' : ''}`);
      if (nombre === voz && estado !== 'open') hallazgos.push(`La línea de los grupos (${nombre}) está «${estado}»: hay que volver a escanear el QR en /whatsapp.`);
    }
    if (voz && !(Array.isArray(lista) && lista.some((i) => (i.name ?? i.instanceName) === voz))) hallazgos.push(`Evolution no conoce la línea ${voz}: se borró o cambió de nombre.`);
  } catch (e) {
    console.log(`   No pude hablar con Evolution: ${e instanceof Error ? e.message : String(e)}`);
    hallazgos.push('Evolution (Railway) no contesta: sin eso no entra ni sale ningún mensaje. Mirar el servicio en Railway.');
  }
  console.log('   ⚠️ «open» sale de la base de Evolution y puede mentir (lib/evolution.ts, `connectionState`): si dice open y nada sale, mandar un mensaje de prueba.');
} else {
  console.log('   (este .env no tiene EVOLUTION_BASE_URL / EVOLUTION_API_KEY: no miré la conexión)');
}

// ── 1b. ¿Le llega algo? (la línea SORDA, 9/11: manda, contesta la sonda y no recibe nada) ──
const ultimo = (await leer<Array<{ created_at: string; workspace_id: number }>>(db.from('mako_doer_buffer').select('created_at, workspace_id').order('created_at', { ascending: false }).limit(1), 'lo último que llegó'))[0];
const horasSinNada = ultimo ? (ahora - Date.parse(ultimo.created_at)) / 3600_000 : Infinity;
console.log(`   Lo último que le llegó a MaKo de una persona: ${ultimo ? `${hora(ultimo.created_at)} (hace ${horasSinNada.toFixed(1)} h, ws${ultimo.workspace_id})` : 'nada guardado'}`);
if (horasSinNada >= 3) {
  console.log('   ⚠️ Puede estar SORDA (docs/hallazgos-comunicacion.md, «La línea sorda»): volver a correr esto en 5 minutos y comparar los mensajes guardados.');
  console.log('      Si alguien escribió en un grupo (con su hora) y no aparece, y el número no se mueve, es sorda: se arregla volviendo a escanear el QR.');
  console.log('      ⚠️ De noche, o un rato quieto, puede ser falta de tráfico o demora del teléfono que manda (10/11, ticket #79): no es prueba.');
  hallazgos.push(`Hace ${horasSinNada.toFixed(1)} h que no le llega nada a MaKo: puede ser la línea sorda (ver el punto 1b).`);
}

// ── 2. El freno ─────────────────────────────────────────────────────────────
const plataforma = (await leer<Array<{ id: number }>>(db.from('workspaces').select('id').eq('capa', 'superadmin'), 'el workspace de la plataforma'))[0]?.id;
const frenos = plataforma == null ? [] : await leer<Array<{ key: string; value: string; updated_at?: string }>>(db.from('app_settings').select('key, value').eq('workspace_id', plataforma).like('key', 'linea.freno.%'), 'los frenos');
console.log('\n2. El freno de las líneas (WhatsApp devolvió 403, 463 o «rate-overlimit»):');
let algunoVigente = false;
for (const f of frenos) {
  const v = frenoVigente(f.value);
  const linea = f.key.replace(/^linea\.freno\./, '');
  if (v) algunoVigente = true;
  console.log(`   · ${linea}: ${v ? `FRENADA — ${textoDelFreno(v)} (desde ${hora(v.desde)}, por ${v.ruta ?? '?'})` : 'sin freno vigente'}`);
  if (v && linea === voz) hallazgos.push(`La línea de los grupos está FRENADA (${v.tipo}, hasta ${hora(v.hasta)}). Desde el 11/11 la respuesta a quien escribe pasa igual; antes, MaKo quedaba mudo hasta esa hora.`);
}
if (!frenos.length) console.log('   · ninguna línea tiene freno guardado');
if (!algunoVigente && frenos.length) console.log('   · ningún freno vigente ahora');

// ── 3. El interruptor ───────────────────────────────────────────────────────
const activo = (await leer<Array<{ value: string }>>(db.from('app_settings').select('value').eq('workspace_id', 1).eq('key', 'mako.doer.activo'), 'el interruptor del doer'))[0]?.value ?? null;
console.log(`\n3. MaKo en los grupos (\`mako.doer.activo\` del ws1): ${activo === 'false' ? 'APAGADO' : 'prendido'}`);
if (activo === 'false') hallazgos.push('El doer está APAGADO para todos los grupos (`mako.doer.activo` = false en el ws1).');

// ── 4. La cola ──────────────────────────────────────────────────────────────
const hace5 = new Date(ahora - 5 * 60_000).toISOString();
const cola = await leer<Array<{ workspace_id: number; grupo_jid: string; created_at: string }>>(
  db.from('mako_doer_buffer').select('workspace_id, grupo_jid, created_at').eq('estado', 'pendiente').lt('created_at', hace5).gte('created_at', desde).order('created_at', { ascending: true }).limit(500),
  'la cola de mensajes');
console.log(`\n4. Mensajes de personas que quedaron en la cola sin turno (más de 5 min): ${cola.length}`);
for (const c of cola.slice(0, 15)) console.log(`   · ws${c.workspace_id} ${corto(c.grupo_jid)} desde ${hora(c.created_at)}`);
if (cola.length) hallazgos.push(`${cola.length} mensaje(s) quedaron en la cola sin contestar: el cron \`doer-flush\` no los está levantando (mirar sus corridas en Vercel).`);

// ── 5. Los turnos sin respuesta ─────────────────────────────────────────────
const conv = await leer<Array<{ id: number; workspace_id: number; grupo_jid: string; role: string; content: string; created_at: string }>>(
  db.from('mako_doer_conv').select('id, workspace_id, grupo_jid, role, content, created_at').like('grupo_jid', '%@g.us').gte('created_at', desde).order('created_at', { ascending: true }).limit(5000),
  'la conversación de los grupos');
const silencios = (incidentesDe(conv, [], ahora) as Array<{ tipos: string[]; ws: number; grupo: string | null; at: string }>).filter((i) => i.tipos.includes('sin-respuesta'));
console.log(`\n5. Mensajes sin respuesta de MaKo (más de ${ESPERA_RESPUESTA_MS / 60_000} min): ${silencios.length} de ${conv.filter((c) => c.role === 'user').length} mensajes de personas`);
for (const s of silencios.slice(-15)) console.log(`   · ws${s.ws} ${corto(s.grupo ?? '')} a las ${hora(s.at)}`);
const perdidas = await leer<Array<{ titulo: string; veces: number; ultima_vez: string }>>(
  db.from('errores_app').select('titulo, veces, ultima_vez').eq('origen', 'mako').gte('ultima_vez', desde).ilike('titulo', '%contestar en WhatsApp%'),
  'los errores de entrega');
console.log(`   Respuestas que WhatsApp no tomó (desde el 11/11 dejan su ticket): ${perdidas.reduce((n, p) => n + p.veces, 0)}`);
if (silencios.length) hallazgos.push(`${silencios.length} mensaje(s) quedaron sin respuesta en ${new Set(silencios.map((s) => `${s.ws}|${s.grupo}`)).size} grupo(s).`);

// ── El vigía ────────────────────────────────────────────────────────────────
const vigia = (process.env.VIGIA_GRUPOS ?? '').trim().toLowerCase();
console.log(`\nEl vigía de los grupos (/api/cron/vigia-grupos, \`VIGIA_GRUPOS\`): ${vigia || '(no está en este .env)'} — en Vercel: npx vercel env ls | grep VIGIA_GRUPOS`);
if (vigia !== 'on') console.log('   Si no está en «on», nadie levanta un ticket cuando MaKo se calla: prenderlo es lo que evita enterarse por Martín.');

console.log(`\n${hallazgos.length ? 'Lo que encontré:' : 'No encontré ninguna de las causas en esta ventana: mirar qué se contestó (docs/hallazgos-comunicacion.md, «MaKo no le responde a Leandro»).'}`);
for (const h of hallazgos) console.log(`  · ${h}`);
