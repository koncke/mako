// =============================================================================
// zona-negocio-backfill — la zona de cada negocio, con su ORIGEN (undécima tanda de Automations)
// =============================================================================
// Decisión 4 de la décima, literal de Martín (11/10/2026): «Si, siempre por ubicación que se maneje por defecto.
// Detectando la ubicacion del usuario.» Diseño en docs/diseno-undecima-tanda.md §2 (decisión 4), §8.5.1 y §9 (25-27).
// Las reglas son las de lib/zona-negocio-reglas.ts (puras, con test): ESTE script no decide nada por su cuenta.
//
// Qué hace, en cada workspace ACTIVO:
//   · lo guardado en `mako.timezone` se CANONIZA (`zonaCanonica`: el ws13 tiene el alias `America/Buenos_Aires`, que
//     la tabla de acentos no conoce) y, si no tiene origen, se marca 'legado';
//   · si NO hay zona, se pregunta a sus integraciones, en orden de autoridad —Cal.com → Google Calendar → la cuenta
//     publicitaria de Meta (`timezone_name`) → el teléfono de los avisos si su país tiene una sola zona— y se decide
//     con `decidirZona` (una inferencia sólo llena un vacío). El ws1 no tiene zona y su Google da invalid_grant: lo
//     llena Meta (America/Tijuana). Hoy el motor lo medía en hora de Ciudad de México.
//   · nada más: la detección por el navegador de sus admins (app/_components/zona-actions.ts) sigue después.
//
//   npx tsx scripts/zona-negocio-backfill.mts                 → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/zona-negocio-backfill.mts --simular       → lo mismo, dicho explícito
//   npx tsx scripts/zona-negocio-backfill.mts --aplicar       → escribe (lo decide quien cierra la tanda)
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<n> (sólo ese workspace)
//
// ⚠️ COMPATIBLE CON EL CÓDIGO VIEJO Y CON EL NUEVO: el viejo lee `mako.timezone` cruda (una IANA válida en los dos
// casos) e ignora `mako.timezone.origen`. Puede ir antes o después del deploy; se recomienda después del OK (§8.5).
//
// ⚠️ LEE Y PREGUNTA, NO ESCRIBE (salvo --aplicar). Las integraciones se consultan con GETs (y el refresh de Google,
// en memoria): ninguna key se imprime. Escribe con la service role, sin `server-only` (el patrón de
// scripts/ai-step-v2.mts): cada escritura filtra `workspace_id` y es compare-and-set — update con
// `.eq('updated_at', <lo leído>)` si la clave existía, insert SIN upsert si no (choca si alguien la creó en el medio).
//
// ⚠️ EL RESPALDO VA PRIMERO (con --aplicar): `backups/zona-negocio-<ISO>.json` con las DOS claves de cada workspace
// que cambia, con su `updated_at` (null = no existía). Se relee y se compara; si no sirve, no se escribe nada. Volver
// atrás es reponer ese valor con su `updated_at` de entonces, y BORRAR la clave que no existía.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
config({ path: arg('env') ?? '.env.local', quiet: true });
const soloWs = arg('ws') ? Number(arg('ws')) : null;

const {
  CLAVE_ZONA, CLAVE_ZONA_ORIGEN, zonaCanonica, zonaDeUbicacion, leerOrigen, origenVigente, origenParaGuardar, decidirZona,
  textoOrigen,
} = await import('../lib/zona-negocio-reglas');
type OrigenZona = import('../lib/zona-negocio-reglas').OrigenZona;
const { descifrar, versionCripto } = await import('../lib/cripto-credenciales');
const { tzDeTelefono } = await import('../lib/paises');
const { normalizarCuentaMeta } = await import('../lib/meta-cuenta-id');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

const POR = 'zona-negocio-backfill';
const KEY_GOOGLE = 'google.calendar.refresh_token';
const KEYS_TEL = ['notif_telefonos', 'user_telefono'];
const META_VER = process.env.META_API_VERSION || 'v24.0';

type Fila = { workspace_id: number; key: string; value: string | null; updated_at: string | null };
/** Una clave tal como está: `updated_at` undefined = no existe. */
type Clave = { value: string | null; updated_at: string | undefined };
type Fuente = { origen: OrigenZona; via: string; tz: string | null; nota?: string };
type Plan = {
  ws: number; nombre: string;
  antes: { tz: Clave; origen: Clave };
  despues: { tz: string | null; origen: string | null };
  escribeTz: boolean; escribeOrigen: boolean; motivo: string; fuentes: Fuente[];
};

const esValorReal = (v: string | null | undefined): v is string => Boolean(v && v.trim() && !v.trim().startsWith('PENDING'));
const corto = (s: unknown, n = 60): string => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

// ── Lectura ───────────────────────────────────────────────────────────────────────────────────────

async function leerWorkspaces(): Promise<Array<{ id: number; nombre: string; estado: string }>> {
  let q = db.from('workspaces').select('id, nombre, estado').order('id', { ascending: true });
  if (soloWs != null) q = q.eq('id', soloWs);
  const { data, error } = await q;
  if (error) throw new Error(`workspaces: ${error.message}`);
  return ((data ?? []) as Array<{ id: number | string; nombre: string; estado: string }>).map((w) => ({ ...w, id: Number(w.id) }));
}

async function leerSettings(keys: string[]): Promise<Fila[]> {
  let q = db.from('app_settings').select('workspace_id, key, value, updated_at').in('key', keys).range(0, 9999);
  if (soloWs != null) q = q.eq('workspace_id', soloWs);
  const { data, error } = await q;
  if (error) throw new Error(`app_settings: ${error.message}`);
  return ((data ?? []) as Fila[]).map((f) => ({ ...f, workspace_id: Number(f.workspace_id) }));
}

async function leerCredenciales(): Promise<Map<number, Record<string, string>>> {
  let q = db.from('credenciales').select('workspace_id, clave, valor_enc').in('clave', ['CALCOM_API_KEY', 'META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID']).range(0, 9999);
  if (soloWs != null) q = q.eq('workspace_id', soloWs);
  const { data, error } = await q;
  if (error) throw new Error(`credenciales: ${error.message}`);
  const out = new Map<number, Record<string, string>>();
  for (const c of (data ?? []) as Array<{ workspace_id: number | string; clave: string; valor_enc: string }>) {
    const ws = Number(c.workspace_id);
    const v = descifrar(c.valor_enc, ws, c.clave);
    if (!esValorReal(v)) continue;
    out.set(ws, { ...(out.get(ws) ?? {}), [c.clave]: v.trim() });
  }
  return out;
}

const clave = (filas: Fila[], ws: number, k: string): Clave => {
  const f = filas.find((x) => x.workspace_id === ws && x.key === k);
  return f ? { value: f.value, updated_at: f.updated_at ?? '' } : { value: null, updated_at: undefined };
};

// ── Las fuentes (GETs de sólo lectura, con techo) ──────────────────────────────────────────────────

async function json(u: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const r = await fetch(u, { ...init, signal: AbortSignal.timeout(10_000) });
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, body };
}

async function deCalcom(apiKey: string): Promise<Fuente> {
  try {
    const r = await json('https://api.cal.com/v2/me', { headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-08-13' } });
    if (!r.ok) return { origen: 'calendario', via: 'Cal.com', tz: null, nota: `HTTP ${r.status}` };
    const d = (r.body.data ?? r.body) as { timeZone?: unknown };
    return { origen: 'calendario', via: 'Cal.com', tz: typeof d.timeZone === 'string' ? d.timeZone : null };
  } catch (e) { return { origen: 'calendario', via: 'Cal.com', tz: null, nota: corto(e instanceof Error ? e.message : e, 50) }; }
}

async function deGoogle(ws: number, guardado: string): Promise<Fuente> {
  const via = 'Google Calendar';
  const rt = versionCripto(guardado) === 'otro' ? guardado : descifrar(guardado, ws, KEY_GOOGLE);
  if (!esValorReal(rt)) return { origen: 'calendario', via, tz: null, nota: 'refresh ilegible' };
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return { origen: 'calendario', via, tz: null, nota: 'sin GOOGLE_CLIENT_ID/SECRET' };
  try {
    const t = await json('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }),
    });
    const at = t.body.access_token;
    if (typeof at !== 'string') return { origen: 'calendario', via, tz: null, nota: String(t.body.error ?? `HTTP ${t.status}`) };
    const c = await json('https://www.googleapis.com/calendar/v3/calendars/primary', { headers: { Authorization: `Bearer ${at}` } });
    return { origen: 'calendario', via, tz: typeof c.body.timeZone === 'string' ? c.body.timeZone : null, ...(c.ok ? {} : { nota: `HTTP ${c.status}` }) };
  } catch (e) { return { origen: 'calendario', via, tz: null, nota: corto(e instanceof Error ? e.message : e, 50) }; }
}

async function deMeta(token: string, cuenta: string): Promise<Fuente> {
  const via = 'Meta (cuenta publicitaria)';
  try {
    const u = new URL(`https://graph.facebook.com/${META_VER}/${normalizarCuentaMeta(cuenta)}`);
    u.searchParams.set('fields', 'name,timezone_name');
    u.searchParams.set('access_token', token);
    const r = await json(u.toString());
    if (r.body.error) return { origen: 'meta', via, tz: null, nota: corto((r.body.error as { message?: string }).message, 60) };
    return { origen: 'meta', via: `${via} «${corto(r.body.name, 30)}»`, tz: typeof r.body.timezone_name === 'string' ? r.body.timezone_name : null };
  } catch (e) { return { origen: 'meta', via, tz: null, nota: corto(e instanceof Error ? e.message : e, 50) }; }
}

function deTelefono(filas: Fila[], ws: number): Fuente {
  const lista = clave(filas, ws, 'notif_telefonos').value;
  let tel: string | null = null;
  try { const l = JSON.parse(lista ?? 'null'); if (Array.isArray(l) && typeof l[0] === 'string') tel = l[0]; } catch { /* lista rota: el viejo */ }
  tel = tel || clave(filas, ws, 'user_telefono').value || null;
  return { origen: 'telefono', via: 'teléfono de los avisos', tz: tzDeTelefono(tel), ...(tel ? {} : { nota: 'sin teléfono' }) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════

const inicio = new Date();
console.log(`\n══ ZONA DEL NEGOCIO${soloWs != null ? ` · ws${soloWs}` : ' · todos los workspaces'} — ${aplicar ? 'APLICANDO' : 'SIMULACRO (sólo lee, no escribe nada)'} · ${inicio.toISOString()} ══`);

const workspaces = await leerWorkspaces();
const filas = await leerSettings([CLAVE_ZONA, CLAVE_ZONA_ORIGEN, KEY_GOOGLE, ...KEYS_TEL]);
const creds = await leerCredenciales();

const planes: Plan[] = [];
for (const w of workspaces) {
  const tz = clave(filas, w.id, CLAVE_ZONA);
  const og = clave(filas, w.id, CLAVE_ZONA_ORIGEN);
  const linea = `── ws${w.id} · «${corto(w.nombre, 30)}» · ${w.estado}`;
  if (w.estado !== 'activo') { console.log(`\n${linea}: no está activo, no se toca`); continue; }

  // Las fuentes, en orden de autoridad. Se consultan siempre (para ver si coinciden con lo guardado), pero
  // `decidirZona` sólo deja que llenen un vacío.
  const c = creds.get(w.id) ?? {};
  const fuentes: Fuente[] = [];
  if (c.CALCOM_API_KEY) fuentes.push(await deCalcom(c.CALCOM_API_KEY));
  const g = clave(filas, w.id, KEY_GOOGLE).value;
  if (esValorReal(g)) fuentes.push(await deGoogle(w.id, g));
  if (c.META_ACCESS_TOKEN && c.META_AD_ACCOUNT_ID) fuentes.push(await deMeta(c.META_ACCESS_TOKEN, c.META_AD_ACCOUNT_ID));
  fuentes.push(deTelefono(filas, w.id));

  // Lo guardado, canonizado; su origen vale sólo si es de esa zona.
  const guardada = zonaCanonica(tz.value);
  const vigente = origenVigente(leerOrigen(og.value), guardada);
  let actual: { tz: string | null; origen: OrigenZona | null } = { tz: guardada, origen: vigente?.origen ?? null };
  let motivo = '';
  let origenNuevo: OrigenZona | null = null;
  for (const f of fuentes) {
    const z = zonaDeUbicacion(f.tz);
    if (!z) continue;
    if (decidirZona(actual, { tz: z, origen: f.origen }, inicio.getTime()) === 'escribir') {
      actual = { tz: z, origen: f.origen };
      origenNuevo = f.origen;
      motivo = `sin zona → ${z} (${f.via})`;
      break;
    }
  }
  if (!origenNuevo && guardada && !vigente) { origenNuevo = 'legado'; motivo = 'ya estaba guardada: origen legado'; }
  const tzFinal = actual.tz;
  const escribeTz = tzFinal != null && tzFinal !== tz.value;
  if (escribeTz && guardada && tzFinal === guardada) motivo += `${motivo ? ' · ' : ''}se canoniza «${tz.value}» → ${guardada}`;
  const escribeOrigen = origenNuevo != null;
  const origenValor = escribeOrigen && tzFinal ? origenParaGuardar(origenNuevo!, tzFinal, POR, inicio) : og.value;

  console.log(`\n${linea}`);
  console.log(`  antes:   ${tz.updated_at === undefined ? '(sin zona)' : `«${tz.value}»`} · ${vigente ? textoOrigen(vigente) : og.updated_at === undefined ? 'sin origen' : `origen huérfano/ilegible «${corto(og.value, 50)}»`}`);
  for (const f of fuentes) console.log(`  fuente:  ${f.via}: ${f.tz ?? '—'}${f.nota ? ` (${f.nota})` : ''}${f.tz && guardada && zonaCanonica(f.tz) !== guardada ? ' ⚠ no coincide con la guardada (no la pisa)' : ''}`);
  if (!escribeTz && !escribeOrigen) { console.log(`  después: nada que hacer${guardada ? '' : ' (sin zona y sin fuentes: queda el default America/Tijuana hasta que la detecte el navegador de un admin)'}`); continue; }
  console.log(`  después: «${tzFinal}» · origen ${origenNuevo}${escribeTz ? ' · ESCRIBE la zona' : ''}${escribeOrigen ? ' · ESCRIBE el origen' : ''} — ${motivo}`);
  planes.push({ ws: w.id, nombre: w.nombre, antes: { tz, origen: og }, despues: { tz: tzFinal, origen: origenValor }, escribeTz, escribeOrigen, motivo, fuentes });
}

console.log(`\n══ Resumen: ${planes.length} workspace(s) a escribir ══`);
for (const p of planes) console.log(`  · ws${p.ws}: ${p.despues.tz} · ${leerOrigen(p.despues.origen)?.origen ?? '—'} — ${p.motivo}`);

if (!aplicar) {
  console.log('\nSIMULACRO: no se escribió nada. Con --aplicar se escriben, con respaldo antes.');
  process.exit(0);
}

// ── Con --aplicar: el respaldo primero, releído; si no sirve, nada se escribe ─────────────────────
const RESPALDO = `backups/zona-negocio-${inicio.toISOString().replace(/[:.]/g, '-')}.json`;
mkdirSync('backups', { recursive: true });
const respaldo = planes.map((p) => ({
  workspace_id: p.ws,
  [CLAVE_ZONA]: { value: p.antes.tz.value, updated_at: p.antes.tz.updated_at ?? null },
  [CLAVE_ZONA_ORIGEN]: { value: p.antes.origen.value, updated_at: p.antes.origen.updated_at ?? null },
}));
writeFileSync(RESPALDO, JSON.stringify({ hecho_at: new Date().toISOString(), filas: respaldo }, null, 1), 'utf8');
const vuelta = JSON.parse(readFileSync(RESPALDO, 'utf8')) as { filas?: typeof respaldo };
const malas = planes.filter((p) => {
  const x = (vuelta.filas ?? []).find((y) => y?.workspace_id === p.ws) as Record<string, { value: string | null; updated_at: string | null }> | undefined;
  return !x
    || x[CLAVE_ZONA]?.value !== p.antes.tz.value || x[CLAVE_ZONA]?.updated_at !== (p.antes.tz.updated_at ?? null)
    || x[CLAVE_ZONA_ORIGEN]?.value !== p.antes.origen.value || x[CLAVE_ZONA_ORIGEN]?.updated_at !== (p.antes.origen.updated_at ?? null);
});
if (malas.length) throw new Error(`el respaldo ${RESPALDO} no sirve (${malas.map((p) => `ws${p.ws}`).join(', ')}): no se escribió nada`);
console.log(`\n✓ respaldo de ${planes.length} workspace(s), releído: ${RESPALDO}`);

/** Compare-and-set: update si existía y nadie la tocó; insert SIN upsert si no existía. Devuelve si ganó. */
async function escribirSi(ws: number, k: string, valor: string, leido: Clave): Promise<{ ok: boolean; error?: string }> {
  const ahora = new Date().toISOString();
  if (leido.updated_at === undefined) {
    const { error } = await db.from('app_settings').insert({ workspace_id: ws, key: k, value: valor, updated_at: ahora });
    return error ? { ok: false, error: error.code === '23505' ? 'alguien la creó en el medio' : error.message } : { ok: true };
  }
  let q = db.from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', k);
  q = leido.updated_at ? q.eq('updated_at', leido.updated_at) : q.is('updated_at', null);
  const { data, error } = await q.select('key');
  if (error) return { ok: false, error: error.message };
  return (data ?? []).length ? { ok: true } : { ok: false, error: 'cambió mientras tanto (updated_at)' };
}

let ok = 0;
for (const p of planes) {
  if (p.escribeTz) {
    const r = await escribirSi(p.ws, CLAVE_ZONA, p.despues.tz!, p.antes.tz);
    if (!r.ok) { console.log(`  ✖ ws${p.ws}: la zona no se escribió (${r.error}); el origen tampoco. Vuelve a correr el simulacro.`); continue; }
  }
  if (p.escribeOrigen) {
    const r = await escribirSi(p.ws, CLAVE_ZONA_ORIGEN, p.despues.origen!, p.antes.origen);
    if (!r.ok) { console.log(`  ✖ ws${p.ws}: la zona quedó en ${p.despues.tz} pero el origen no se escribió (${r.error}).`); continue; }
  }
  ok++;
}

// Se relee lo que quedó y se compara con lo planeado.
const despues = await leerSettings([CLAVE_ZONA, CLAVE_ZONA_ORIGEN]);
console.log('\n══ Antes → después (releído) ══');
for (const p of planes) {
  const tz = clave(despues, p.ws, CLAVE_ZONA);
  const og = clave(despues, p.ws, CLAVE_ZONA_ORIGEN);
  const bien = tz.value === p.despues.tz && og.value === p.despues.origen;
  console.log(`  ${bien ? '✓' : '✖'} ws${p.ws}: «${p.antes.tz.value ?? '(sin zona)'}» → «${tz.value ?? '(sin zona)'}» · ${textoOrigen(leerOrigen(og.value))}`);
}
console.log(`\n══ ${ok} de ${planes.length} escritos ══`);
