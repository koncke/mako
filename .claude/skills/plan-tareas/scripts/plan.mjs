#!/usr/bin/env node
// =============================================================================
// plan.mjs — CLI para que Claude Code REVISE el plan del dueño y le DEJE tareas
// =============================================================================
// El board del super-admin (/plan/agencia) vive en el localStorage del navegador:
// el servidor/este script NO lo ven directo. Pero el board empuja una FOTO de
// sólo-lectura (mako.plan.snapshot) y lee una BANDEJA (mako.plan.inbox) al abrir.
// Este script usa esas dos settings (app_settings, workspace 1) con el service_role
// de .env.local (apunta a PROD). Sirve para:
//   node plan.mjs review                 → imprime el plan (proyectos + tareas por prioridad, vencidos)
//   node plan.mjs add --title "..." [--priority alta|media|baja|futuro] [--project "Nombre"]
//        [--detalle "..."] [--chat "tema del chat"] [--url "https://..."]
//        → deja UNA tarea en la bandeja, marcada como origen Claude Code (con el chat de dónde salió).
//
// La bandeja la mergea el board la próxima vez que el dueño abre /plan (dedup por refId).
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// .claude/skills/plan-tareas/scripts → raíz del repo (4 niveles arriba)
const ROOT = resolve(HERE, '..', '..', '..', '..');
const OWNER_WS = 1;
const KEY_SNAP = 'mako.plan.snapshot';
const KEY_INBOX = 'mako.plan.inbox';
const CAP = 200;
const PRIOS = ['alta', 'media', 'baja', 'futuro'];

function loadEnv() {
  const env = {};
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(resolve(ROOT, f), 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* no existe */ }
  }
  return env;
}

function sb() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1); }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getSetting(client, k) {
  const { data } = await client.from('app_settings').select('value').eq('workspace_id', OWNER_WS).eq('key', k).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(client, k, v) {
  await client.from('app_settings').upsert({ workspace_id: OWNER_WS, key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true'; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

function bandaVencida(deadline) {
  if (!deadline) return '';
  const hoy = new Date().toISOString().slice(0, 10);
  if (deadline < hoy) return ' ⚠ VENCIDA';
  if (deadline === hoy) return ' ⏰ HOY';
  return '';
}
function banda(score) {
  const s = Number(score) || 0;
  if (s >= 75) return 'ALTA ';
  if (s >= 50) return 'media';
  if (s >= 25) return 'baja ';
  return 'futur';
}

async function review(client) {
  const rawSnap = await getSetting(client, KEY_SNAP);
  const rawInbox = await getSetting(client, KEY_INBOX);
  let snap = { proyectos: [], tareas: [], ts: 0 };
  try { if (rawSnap) snap = JSON.parse(rawSnap); } catch { /* */ }
  let inbox = [];
  try { if (rawInbox) inbox = JSON.parse(rawInbox); } catch { /* */ }

  const edadMin = snap.ts ? Math.round((Date.now() - snap.ts) / 60000) : null;
  console.log(`\n📋 PLAN DEL DUEÑO — foto de hace ${edadMin == null ? '¿?' : edadMin} min\n`);

  if (snap.proyectos?.length) {
    console.log(`PROYECTOS (${snap.proyectos.length}):`);
    for (const p of snap.proyectos) console.log(`  ${p.pid || '—'}  ${p.nombre}`);
    console.log('');
  }

  const tareas = (snap.tareas || []).slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  console.log(`TAREAS ABIERTAS (${tareas.length}, por prioridad):`);
  for (const t of tareas.slice(0, 60)) {
    console.log(`  [${banda(t.score)} ${String(Number(t.score) || 0).padStart(3)}] #${t.num} ${t.titulo}${t.proyecto ? `  ·  ${t.proyecto}` : ''}${bandaVencida(t.deadline)}`);
  }
  if (tareas.length > 60) console.log(`  … y ${tareas.length - 60} más`);

  const vencidas = tareas.filter((t) => bandaVencida(t.deadline).includes('VENCIDA'));
  const altas = tareas.filter((t) => (Number(t.score) || 0) >= 75);
  console.log(`\n⚠ ${altas.length} en ALTA · ${vencidas.length} vencidas · ${inbox.length} sin mergear en la bandeja`);
  console.log('\nREGLA: antes de arrancar una tarea grande, mirá esta lista. Si lo que vas a hacer ya');
  console.log('está acá, no dupliques: continuá esa. Si es nuevo y vale la pena, dejalo con `add`.\n');
}

async function add(client, args) {
  const titulo = String(args.title || args.titulo || '').trim();
  if (!titulo) { console.error('Falta --title'); process.exit(1); }
  const prioridad = PRIOS.includes(args.priority) ? args.priority : 'media';
  const chat = (args.chat || args.etiqueta || '').toString().trim();
  const url = (args.url || '').toString().trim();

  const raw = await getSetting(client, KEY_INBOX);
  let prev = [];
  try { if (raw) prev = JSON.parse(raw); } catch { /* */ }
  const now = Date.now();
  const nueva = {
    refId: `cc${now}`,
    titulo: titulo.slice(0, 200),
    prioridad,
    proyecto: args.project ? String(args.project).slice(0, 120) : undefined,
    deadline: args.deadline || undefined,
    detalle: args.detalle ? String(args.detalle).slice(0, 600) : undefined,
    fuente: { tipo: 'claude-code', etiqueta: chat || undefined, url: url || undefined },
    ts: now,
  };
  const next = [...prev, nueva].slice(-CAP);
  await setSetting(client, KEY_INBOX, JSON.stringify(next));
  console.log(`✓ Tarea dejada en la bandeja del dueño (origen: Claude Code${chat ? ` · ${chat}` : ''}).`);
  console.log(`  "${nueva.titulo}" [${prioridad}]${nueva.proyecto ? ` → ${nueva.proyecto}` : ''}`);
  console.log('  Aparece en /plan la próxima vez que el dueño abra el board.');
}

const KEY_OPS = 'mako.plan.ops';
async function pushOp(client, op, num, campos, etiqueta) {
  const raw = await getSetting(client, KEY_OPS);
  let prev = []; try { if (raw) prev = JSON.parse(raw); } catch { /* */ }
  const now = Date.now();
  const nueva = { opId: `op${now}-${Math.floor(now % 100000)}`, op, num: Number(num), campos: campos || undefined, etiqueta: etiqueta || undefined, ts: now };
  await setSetting(client, KEY_OPS, JSON.stringify([...prev, nueva].slice(-300)));
  return nueva;
}
// done/reopen/delete/priority/project/edit — operan sobre una tarea EXISTENTE por #num.
async function opCmd(client, cmd, args) {
  const num = Number(args.num);
  if (!Number.isFinite(num)) { console.error('Falta --num (el #número de la tarea; miralo con `review`).'); process.exit(1); }
  const chat = (args.chat || args.etiqueta || '').toString().trim() || undefined;
  let op, campos;
  if (cmd === 'done') op = 'completar';
  else if (cmd === 'reopen') op = 'reabrir';
  else if (cmd === 'delete') op = 'borrar';
  else if (cmd === 'priority') { op = 'prioridad'; campos = { score: Number(args.score) }; if (!Number.isFinite(campos.score)) { console.error('Falta --score 1-100'); process.exit(1); } }
  else if (cmd === 'project') { op = 'proyecto'; campos = { proyecto: String(args.project || '') }; if (!campos.proyecto) { console.error('Falta --project "Nombre"'); process.exit(1); } }
  else if (cmd === 'edit') {
    op = 'editar'; campos = {};
    if (args.title) campos.titulo = String(args.title);
    if (args.detalle) campos.detalle = String(args.detalle);
    if (args.priority) campos.prioridad = String(args.priority);
    if (args.deadline) campos.deadline = String(args.deadline);
    if (!Object.keys(campos).length) { console.error('edit necesita al menos --title / --detalle / --priority / --deadline'); process.exit(1); }
  }
  await pushOp(client, op, num, campos, chat);
  console.log(`✓ Operación '${op}' encolada para la tarea #${num}${chat ? ` (${chat})` : ''}.`);
  console.log('  Se aplica (con rastro "Claude Code" en el historial) cuando el dueño abre /plan.');
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'review';
const OPS = ['done', 'reopen', 'edit', 'project', 'priority', 'delete'];
const client = sb();
if (cmd === 'review') await review(client);
else if (cmd === 'add') await add(client, args);
else if (OPS.includes(cmd)) await opCmd(client, cmd, args);
else { console.error(`Comando desconocido: ${cmd}. Usá: review / add / done / reopen / edit / project / priority / delete.`); process.exit(1); }
process.exit(0);
